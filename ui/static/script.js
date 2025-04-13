let lastMtime = 0;
let selectedFile = null;
let selectedFunc = null;
let lastFile = null; // Track last file
let lastFunc = null; // Track last function
let pctThreshold = 15; // Current threshold for highlighting
const defaultThreshold = 15; // Default threshold for reset
let profilingData = null; // Store the loaded profiling data

// Theme toggle logic
const themeToggleBtn = d3.select("#theme-toggle-btn");
const body = d3.select("body");

// Load saved theme preference from localStorage
const savedTheme = localStorage.getItem("theme");
if (savedTheme === "dark") {
    body.classed("dark-theme", true);
    themeToggleBtn.text("☀️"); // Sun icon for light mode toggle
} else {
    themeToggleBtn.text("🌙"); // Moon icon for dark mode toggle
}

// Toggle theme on button click
themeToggleBtn.on("click", () => {
    const isDark = body.classed("dark-theme");
    body.classed("dark-theme", !isDark);
    themeToggleBtn.text(isDark ? "🌙" : "☀️"); // Toggle icon
    localStorage.setItem("theme", isDark ? "light" : "dark"); // Save preference
});

function updateUI(data, file = selectedFile, func = selectedFunc) {
    const treeList = d3.select("#tree-list");
    const linesTable = d3.select("#lines-table tbody");
    const functionStats = d3.select("#function-stats");

    // Clear existing content
    treeList.selectAll("*").remove();
    linesTable.selectAll("tr").remove();
    functionStats.text("");

    // Build tree structure
    const treeUl = treeList.append("ul").attr("class", "directory");
    const root = treeUl.append("li").attr("class", "collapsible expanded").text("Files");
    root.on("click", function() {
        d3.select(this).classed("expanded", !d3.select(this).classed("expanded"));
    });
    const rootChildren = treeUl.append("ul");

    // Sort files to prioritize the entrypoint at the top
    const files = Object.entries(data).filter(([folderName]) => folderName !== "entrypoint");
    files.sort(([aFolderName], [bFolderName]) => {
        const entrypoint = data.entrypoint;
        if (entrypoint) {
            if (aFolderName === entrypoint) return -1; // entrypoint comes first
            if (bFolderName === entrypoint) return 1;  // entrypoint comes first
        }
        return aFolderName.localeCompare(bFolderName); // Sort remaining files alphabetically
    });

    // Treat top-level keys as directories (excluding "entrypoint")
    files.forEach(([folderName, folderData]) => {
        const folderLi = rootChildren.append("li")
            .attr("class", "collapsible expanded")
            .text(folderName);
        folderLi.on("click", function(event) {
            event.stopPropagation();
            d3.select(this).classed("expanded", !d3.select(this).classed("expanded"));
        });

        const funcUl = rootChildren.append("ul");
        const sortedFuncs = Object.entries(folderData).sort((a, b) => {
            const aLine = Math.min(...Object.keys(a[1].line).map(Number));
            const bLine = Math.min(...Object.keys(b[1].line).map(Number));
            return aLine - bLine;
        });
        sortedFuncs.forEach(([funcName, _]) => {
            const funcLi = funcUl.append("li")
                .attr("class", "function")
                .text(funcName)
                .on("click", (event) => {
                    event.stopPropagation();
                    if (selectedFile && selectedFunc && (selectedFile !== folderName || selectedFunc !== funcName)) {
                        lastFile = selectedFile;
                        lastFunc = selectedFunc;
                    }
                    selectedFile = folderName;
                    selectedFunc = funcName;
                    updateUI(profilingData, selectedFile, selectedFunc);
                });
            if (folderName === selectedFile && funcName === selectedFunc) {
                funcLi.classed("active", true);
            }
        });
    });

    // Update line details if a function is selected
    if (selectedFile && selectedFunc && data[selectedFile] && data[selectedFile][selectedFunc]) {
        const funcData = data[selectedFile][selectedFunc];
        const totalTimeSeconds = (funcData.total_time / 1e9).toFixed(6);
        functionStats.html(`Total Time: ${totalTimeSeconds} s`);

        const allFunctions = new Set();
        Object.values(data).forEach(fileData => {
            if (fileData === data.entrypoint) return; // Skip entrypoint
            Object.keys(fileData).forEach(funcName => allFunctions.add(funcName));
        });

        const lines = Object.entries(funcData.line)
            .map(([lineNum, info]) => {
                let calls = null;
                if (info.code && typeof info.code === "string" && !info.code.match(/^def\s/)) {
                    for (const funcName of allFunctions) {
                        if (info.code.includes(funcName)) {
                            calls = funcName;
                            break;
                        }
                    }
                }
                return { line: lineNum, ...info, calls };
            })
            .sort((a, b) => +a.line - +b.line);

        const rows = linesTable.selectAll("tr")
            .data(lines)
            .enter()
            .append("tr")
            .classed("clickable", (d, i) => i === 0 || !!d.calls)
            .classed("highlight-red", d => d.pct_time && parseFloat(d.pct_time) > pctThreshold)
            .on("click", function(event, d) {
                const index = linesTable.selectAll("tr").nodes().indexOf(this);
                if (index === 0) {
                    if (lastFile && lastFunc) {
                        selectedFile = lastFile;
                        selectedFunc = lastFunc;
                        updateUI(profilingData, selectedFile, selectedFunc);
                    }
                } else if (d.calls) {
                    let targetFile = null;
                    for (const [fileName, fileData] of Object.entries(profilingData)) {
                        if (fileName === "entrypoint") continue;
                        if (d.calls in fileData) {
                            targetFile = fileName;
                            break;
                        }
                    }
                    if (targetFile) {
                        lastFile = selectedFile;
                        lastFunc = selectedFunc;
                        selectedFile = targetFile;
                        selectedFunc = d.calls;
                        updateUI(profilingData, selectedFile, selectedFunc);
                    }
                }
            });

        rows.append("td").text(d => d.line);
        rows.append("td").text((d, i) => i === 0 ? "👈" : (d.calls ? "✔️" : "-"));
        rows.append("td").text(d => d.count || "-");
        rows.append("td").text(d => d.time ? (d.time / 1e9).toFixed(6) + " s" : "-");
        rows.append("td").text(d => d.pct_time !== "" ? d.pct_time + "%" : "-");
        rows.append("td").attr("class", "code").text(d => d.code || "-");
    }
}

function showMainContent() {
    d3.select("#drag-drop-zone").style("display", "none");
    d3.select("#main-content").style("display", "block");
}

function showDragDropZone() {
    d3.select("#drag-drop-zone").style("display", "flex");
    d3.select("#main-content").style("display", "none");
}

function loadJSONData(data) {
    profilingData = data;

    // Set the default selected file based on the entrypoint
    if (data.entrypoint && typeof data.entrypoint === "string" && data[data.entrypoint]) {
        selectedFile = data.entrypoint;
        const functions = Object.keys(data[selectedFile]);
        if (functions.includes("main")) {
            selectedFunc = "main"; // Prioritize main() if it exists
        } else {
            selectedFunc = functions.length > 0 ? functions[0] : null;
        }
    } else {
        const files = Object.keys(data).filter(key => key !== "entrypoint");
        selectedFile = files.length > 0 ? files[0] : null;
        if (selectedFile) {
            const functions = Object.keys(data[selectedFile]);
            if (functions.includes("main")) {
                selectedFunc = "main"; // Prioritize main() if it exists
            } else {
                selectedFunc = functions.length > 0 ? functions[0] : null;
            }
        }
    }

    showMainContent();
    updateUI(profilingData, selectedFile, selectedFunc);
}

// Check if /profile.json exists on the server
fetch("/profile.json", { method: "GET" })
    .then(response => {
        if (response.ok) {
            return response.json();
        } else {
            throw new Error("profile.json not found");
        }
    })
    .then(data => {
        loadJSONData(data);
    })
    .catch(error => {
        console.log("Error fetching /profile.json:", error.message);
        showDragDropZone();

        // Drag-and-drop logic
        const dragDropZone = d3.select("#drag-drop-zone");
        const fileInput = d3.select("#file-input");

        // Prevent default behavior for drag events
        dragDropZone
            .on("dragover", function(event) {
                event.preventDefault();
                event.stopPropagation();
                d3.select(this).classed("dragover", true);
            })
            .on("dragenter", function(event) {
                event.preventDefault();
                event.stopPropagation();
                d3.select(this).classed("dragover", true);
            })
            .on("dragleave", function(event) {
                event.preventDefault();
                event.stopPropagation();
                d3.select(this).classed("dragover", false);
            })
            .on("drop", function(event) {
                event.preventDefault();
                event.stopPropagation();
                d3.select(this).classed("dragover", false);

                const files = event.originalEvent.dataTransfer.files;
                if (files.length > 0) {
                    const file = files[0];
                    if (file.name.endsWith(".json")) {
                        const reader = new FileReader();
                        reader.onload = function(e) {
                            try {
                                const data = JSON.parse(e.target.result);
                                loadJSONData(data);
                            } catch (err) {
                                alert("Invalid JSON file: " + err.message);
                            }
                        };
                        reader.readAsText(file);
                    } else {
                        alert("Please upload a .json file.");
                    }
                }
            });

        // Allow clicking to upload
        dragDropZone.on("click", function() {
            fileInput.node().click();
        });

        // Handle file input change
        fileInput.on("change", function() {
            const file = this.files[0];
            if (file) {
                if (file.name.endsWith(".json")) {
                    const reader = new FileReader();
                    reader.onload = function(e) {
                        try {
                            const data = JSON.parse(e.target.result);
                            loadJSONData(data);
                        } catch (err) {
                            alert("Invalid JSON file: " + err.message);
                        }
                    };
                    reader.readAsText(file);
                } else {
                    alert("Please upload a .json file.");
                }
            }
        });
    });

// Settings modal logic
const modal = d3.select("#settings-modal");
const settingsBtn = d3.select("#settings-btn");
const closeBtn = d3.select("#close-modal");
const saveBtn = d3.select("#save-settings");
const resetBtn = d3.select("#reset-settings");
const thresholdInput = d3.select("#pct-threshold");

settingsBtn.on("click", () => {
    modal.style("display", "block");
    thresholdInput.property("value", pctThreshold);
});

closeBtn.on("click", () => {
    modal.style("display", "none");
});

window.onclick = function(event) {
    if (event.target === modal.node()) {
        modal.style("display", "none");
    }
};

saveBtn.on("click", () => {
    const newThreshold = parseFloat(thresholdInput.property("value"));
    if (!isNaN(newThreshold) && newThreshold >= 0 && newThreshold <= 100) {
        pctThreshold = newThreshold;
        modal.style("display", "none");
        if (profilingData) {
            updateUI(profilingData, selectedFile, selectedFunc);
        }
    } else {
        alert("Please enter a valid percentage between 0 and 100.");
    }
});

resetBtn.on("click", () => {
    pctThreshold = defaultThreshold;
    thresholdInput.property("value", defaultThreshold);
    modal.style("display", "none");
    if (profilingData) {
        updateUI(profilingData, selectedFile, selectedFunc);
    }
});

// Drag-and-drop logic
const dragDropZone = d3.select("#drag-drop-zone");
const fileInput = d3.select("#file-input");

// Use vanilla JavaScript for drag-and-drop to ensure events fire correctly
const dragDropElement = dragDropZone.node();
dragDropElement.addEventListener("dragover", (event) => {
    event.preventDefault();
    event.stopPropagation();
    dragDropZone.classed("dragover", true);
});

dragDropElement.addEventListener("dragenter", (event) => {
    event.preventDefault();
    event.stopPropagation();
    dragDropZone.classed("dragover", true);
});

dragDropElement.addEventListener("dragleave", (event) => {
    event.preventDefault();
    event.stopPropagation();
    dragDropZone.classed("dragover", false);
});

dragDropElement.addEventListener("drop", (event) => {
    event.preventDefault();
    event.stopPropagation();
    dragDropZone.classed("dragover", false);

    const files = event.dataTransfer.files;
    if (files.length > 0) {
        const file = files[0];
        if (file.name.endsWith(".json")) {
            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    const data = JSON.parse(e.target.result);
                    loadJSONData(data);
                } catch (err) {
                    alert("Invalid JSON file: " + err.message);
                }
            };
            reader.readAsText(file);
        } else {
            alert("Please upload a .json file.");
        }
    }
});

// Allow clicking to upload
dragDropZone.on("click", function() {
    fileInput.node().click();
});

// Handle file input change
fileInput.on("change", function() {
    const file = this.files[0];
    if (file) {
        if (file.name.endsWith(".json")) {
            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    const data = JSON.parse(e.target.result);
                    loadJSONData(data);
                } catch (err) {
                    alert("Invalid JSON file: " + err.message);
                }
            };
            reader.readAsText(file);
        } else {
            alert("Please upload a .json file.");
        }
    }
});