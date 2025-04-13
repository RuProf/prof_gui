let lastMtime = 0;
let selectedFile = null;
let selectedFunc = null;
let history = []; // Track navigation history as list of {file, func}
let historyIndex = -1; // Current position in history
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
    const functionNameHeader = d3.select("#function-name"); // Select the function name header
    const goBackBtn = d3.select("#go-back-btn"); // Select the go back button

    // Clear existing content
    treeList.selectAll("*").remove();
    linesTable.selectAll("tr").remove();
    functionStats.text("");

    // Set function name header with parentheses
    functionNameHeader.text(func ? `${file.replace('./', '')}::${func}()` : "No Function Selected");

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
                        history = history.slice(0, historyIndex + 1); // Truncate forward history
                        history.push({ file: selectedFile, func: selectedFunc });
                        historyIndex++;
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
                // Calculate time per hit (time / count in seconds)
                let time_per_hit = "-";
                if (info.time && info.count && info.count > 0) {
                    time_per_hit = (info.time / info.count / 1e9).toFixed(6) + " s";
                }
                return { line: lineNum, ...info, calls, time_per_hit };
            })
            .sort((a, b) => +a.line - +b.line);

        const rows = linesTable.selectAll("tr")
            .data(lines)
            .enter()
            .append("tr");

        rows.append("td").text(d => d.line);
        rows.append("td").text(d => d.count || "-");
        rows.append("td").text(d => d.time ? (d.time / 1e9).toFixed(6) + " s" : "-");
        rows.append("td").text(d => d.time_per_hit);
        rows.append("td")
            .text(d => d.pct_time !== "" ? d.pct_time + "%" : "-")
            .classed("highlight-red", d => d.pct_time && parseFloat(d.pct_time) > pctThreshold);
        rows.append("td")
            .attr("class", "code")
            .text(d => d.code || "-")
            .classed("clickable-code", (d, i) => i === 0 || !!d.calls)
            .on("click", function(event, d) {
                event.stopPropagation(); // Prevent bubbling to row or table
                const index = linesTable.selectAll("tr").nodes().indexOf(this.parentNode);
                if (index === 0) {
                    // Show callers modal instead of navigating back
                    const callersModal = d3.select("#callers-modal");
                    const callersList = d3.select("#callers-list");
                    callersList.selectAll("*").remove(); // Clear previous list

                    // Find functions that call the selected function
                    const callers = [];
                    for (const [fileName, fileData] of Object.entries(data)) {
                        if (fileName === "entrypoint") continue;
                        for (const [funcName, funcData] of Object.entries(fileData)) {
                            if (funcName === selectedFunc && fileName === selectedFile) continue; // Skip self
                            for (const [, lineInfo] of Object.entries(funcData.line)) {
                                if (lineInfo.code && typeof lineInfo.code === "string" && lineInfo.code.includes(selectedFunc)) {
                                    callers.push({ file: fileName, func: funcName });
                                    break;
                                }
                            }
                        }
                    }

                    if (callers.length === 1) {
                        // Directly navigate to the single caller
                        history = history.slice(0, historyIndex + 1); // Truncate forward history
                        history.push({ file: selectedFile, func: selectedFunc });
                        historyIndex++;
                        selectedFile = callers[0].file;
                        selectedFunc = callers[0].func;
                        updateUI(profilingData, selectedFile, selectedFunc);
                    } else if (callers.length > 1) {
                        // Show modal for multiple callers
                        callersList.selectAll("div")
                            .data(callers)
                            .enter()
                            .append("div")
                            .attr("class", "caller-item")
                            .text(d => `${d.file.replace('./', '')}::${d.func}()`)
                            .on("click", function(event, d) {
                                event.stopPropagation();
                                lastFile = selectedFile;
                                lastFunc = selectedFunc;
                                selectedFile = d.file;
                                selectedFunc = d.func;
                                updateUI(profilingData, selectedFile, selectedFunc);
                                callersModal.style("display", "none");
                            });
                        callersModal.style("display", "block");
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
                        history = history.slice(0, historyIndex + 1); // Truncate forward history
                        history.push({ file: selectedFile, func: selectedFunc });
                        historyIndex++;
                        selectedFile = targetFile;
                        selectedFunc = d.calls;
                        updateUI(profilingData, selectedFile, selectedFunc);
                    }
                }
            });
    }

    // Go back button click handler
    goBackBtn.on("click", () => {
        if (historyIndex > 0) {
            historyIndex--;
            const prev = history[historyIndex];
            selectedFile = prev.file;
            selectedFunc = prev.func;
            updateUI(profilingData, selectedFile, selectedFunc);
        }
    });
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
        // Initialize history with the first selection
        history = [{ file: selectedFile, func: selectedFunc }];
        historyIndex = 0;
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
            // Initialize history with the first selection
            history = [{ file: selectedFile, func: selectedFunc }];
            historyIndex = 0;
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
    if (event.target === d3.select("#callers-modal").node()) {
        d3.select("#callers-modal").style("display", "none");
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

// Callers modal logic
const callersModal = d3.select("#callers-modal");
const closeCallersBtn = d3.select("#close-callers-modal");

closeCallersBtn.on("click", () => {
    callersModal.style("display", "none");
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

var whichButton = function (e) {
    // Handle different event models
    var e = e || window.event;
    var btnCode;

    if ('object' === typeof e) {
        btnCode = e.button;

        switch (btnCode) {
            case 0:
                console.log('0');
            break;
            case 1:
                console.log('1');
            break;
            case 2:
                console.log('2');
            break;
            case 3:
                console.log('Browser Back button clicked.');
            break;

            case 4:
                console.log('Browser Forward button clicked.');
            break;

            default:
                console.log('Unexpected code: ' + btnCode);
        }
    }
};