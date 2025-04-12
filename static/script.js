let lastMtime = 0;
let selectedFile = null;
let selectedFunc = null;
let lastFile = null; // Track last file
let lastFunc = null; // Track last function

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

    // Treat top-level keys as directories
    Object.entries(data).forEach(([folderName, folderData]) => {
        const folderLi = rootChildren.append("li")
            .attr("class", "collapsible expanded")
            .text(folderName);
        folderLi.on("click", function(event) {
            event.stopPropagation();
            d3.select(this).classed("expanded", !d3.select(this).classed("expanded"));
        });

        const funcUl = rootChildren.append("ul");
        // Sort functions by starting line number
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
                    d3.json("/data").then(freshData => {
                        if (selectedFile && selectedFunc && (selectedFile !== folderName || selectedFunc !== funcName)) {
                            lastFile = selectedFile;
                            lastFunc = selectedFunc;
                        }
                        selectedFile = folderName;
                        selectedFunc = funcName;
                        updateUI(freshData, selectedFile, selectedFunc);
                    });
                });
            if (folderName === selectedFile && funcName === selectedFunc) {
                funcLi.classed("active", true);
            }
        });
    });

    // Default to first folder and function if none selected
    if (!selectedFile && Object.keys(data).length > 0) {
        selectedFile = Object.keys(data)[0];
        selectedFunc = Object.keys(data[selectedFile])[0];
    }

    // Update line details if a function is selected
    if (selectedFile && selectedFunc && data[selectedFile] && data[selectedFile][selectedFunc]) {
        const funcData = data[selectedFile][selectedFunc];
        // Show only Total Time in seconds
        const totalTimeSeconds = (funcData.total_time / 1e9).toFixed(6);
        functionStats.html(`Total Time: ${totalTimeSeconds} s`);

        const allFunctions = new Set();
        Object.values(data).forEach(fileData => {
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
            .classed("clickable", (d, i) => i === 0 || !!d.calls) // First row or rows with calls
            .on("click", function(event, d) {
                const index = linesTable.selectAll("tr").nodes().indexOf(this);
                if (index === 0) {
                    // First row: redirect to last file/function if available
                    if (lastFile && lastFunc) {
                        selectedFile = lastFile;
                        selectedFunc = lastFunc;
                        updateUI(data, selectedFile, selectedFunc);
                    }
                } else if (d.calls) {
                    // Other rows: redirect to called function
                    let targetFile = null;
                    for (const [fileName, fileData] of Object.entries(data)) {
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
                        updateUI(data, selectedFile, selectedFunc);
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

// Load data and update UI only if changed
function loadData() {
    d3.json("/data_timestamp").then(ts => {
        if (ts.mtime > lastMtime) {
            d3.json("/data").then(data => {
                lastMtime = ts.mtime;
                updateUI(data, selectedFile, selectedFunc);
            });
        }
    });
}

// Initial load
loadData();

// Poll for updates every 5 seconds
setInterval(loadData, 5000);