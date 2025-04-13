# Profiler GUI

**Prof GUI** is a tool for profiling Python scripts and visualizing performance data through a web interface. It combines a Python-based CLI (`lprof_ext`) for generating profiling data with a high-performance Rust (also have a Python-based version) web server (`prof_gui`) for displaying results interactively.



## Quick Start

### Profiling
```bash
lprof_ext entrypoint.py
# Tips: GUI will trace entrypoint.main() by default.
# It still work even if you don't have main().
```
- **Python Component**: The `lprof_ext` CLI instruments Python scripts with `@profile` decorators to collect performance metrics using the `line_profiler` library, and saving results to `profile.json`.


### Visualizing with GUI
```bash
# Rust Backend (Tiny Image)
docker run --rm -d --name prof_gui \
           -v ./profile.json:/profile.json \
           -p 8080:8080 \
           ruprof/prof_gui:rs

# Python Backend
docker run --rm -d --name prof_gui \
           -v ./profile.json:/profile.json \
           -p 8080:8080 \
           ruprof/prof_gui:python
```

## Features
- Profile Python scripts with minimal setup using `lprof_ext`.
- Visualize profiling data in a browser with a responsive UI.
- Efficient Rust-based API server for low-latency data access.

### Next
- [x] highlight the row into red if pct of time > 30% 
- [x] gear button for setting
- check if `/proile.json` exists
    - [x] exists > load existing profile.json like exisiting script 
    - [x] not exists > serverless, drag & drop > save as /profile.json
- [x] Entrypoint
- [x] gray theme (dark mode)
- [] netron style
- [] mouse -> previous page button = go to lastFile + lastFunc
