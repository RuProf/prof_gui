# Profiler GUI

**Prof GUI** is a tool for profiling Python scripts and visualizing performance data through a web interface. It combines a Python-based CLI (`lprof_ext`) for generating profiling data with a high-performance Rust (also have a Python-based version) web server (`prof_gui`) for displaying results interactively.

## Quick Start

### Profiling
```bash
lprof_ext entrypoint.py
# Tips: GUI will trace entrypoint.main() by default.
# It still work even if you don't have main().
```
- **Python Component**: The `lprof_ext` CLI instruments Python scripts with `@lprofile_ext` decorators to collect performance metrics using the `line_profiler` library, and saving results to `lprof_ext.json`.


### Visualizing with GUI
```bash
# Rust Backend (Tiny Image)
docker run --rm -d --name prof_gui \
           -v ./lprof_ext.json:/lprof_ext.json \
           -p 8080:8080 \
           ruprof/prof_gui:rust

# Python Backend
docker run --rm -d --name prof_gui \
           -v ./lprof_ext.json:/lprof_ext.json \
           -p 8080:8080 \
           ruprof/prof_gui:python
```

## Features
- Profile Python scripts with minimal setup using `lprof_ext`.
- Visualize profiling data in a browser with a responsive UI.
- Efficient Rust-based API server for low-latency data access.
- Support Dark mode
go into func block like VScode

## Features
1. 快速理解一個repo 的trigger flow
  - 灰色code cell is clickable, 
    點擊可以進入下一層
  - 點擊back 可以回到上一頁 (通常係上一層)
  - 點擊 `talbe row 1: def()` , 可以顯示所有call 過該function 的 file:func:hit_count
    3種情況將出現如下
    - 上層數: 0, 無上層, 無得跳                            (ref: main頁面按`def main()`)
    - 上層數: 1, 單一上層, 直接跳到該function 的 file:func  (ref: funcA頁面按`def funcA()`) 
    - 上層數>= 2, 多個上層, modal table to click to jump   (ref: func2頁面按`def func2()`)
  > `進階`, 可以知道func 被邊個func call 最多
  > `進階`, 如需改code, 可以知道func 的上層有乜

2. Execellent for unit test
  - hierarchy of func
  - as usual, 一眼睇晒所有function 的 hit_count, file:func:hit_count
  - generate json 唔需要改code , 一個command 可以decora 所有func , `lprof_ext <test.py>` 

3. 了解一個repo 的processing speed
  - similar to line_profiler layout
  - 紅色highlight func > threshold (15%) can be change in setting button
- Support Dark mode
- file tree
- web base, multi tab 可以多個json compare 
- Visualize profiling data

### Next
- [x] highlight the row into red if pct of time > 30%
- [x] gear button for setting
- check if `/proile.json` exists
    - [x] exists > load existing `lprof_ext.json` like exisiting script
    - [x] not exists > serverless, drag & drop > save as /lprof_ext.json
- [x] Entrypoint
- [x] gray theme (dark mode)
- [] netron style
- [] mouse -> previous page button = go to lastFile + lastFunc

chore
- [x] remove line details , 換做func name
- [x] highlight the cell of pct time instead of row
- [x] highlight the code cell in grey if clickable
- [x] remove col2 clickable
- [x] add hand pointer mouseover clickable code cell
- [x] add hyper formatting clickable code cell in blue font
- [x] backbutton for last page
- [x] trace last page record in list
- [x] modal table view for hierarchy called
- [x] [x] add a button for "collapse" and "expand" button for tree panel
- [] is profile list needed?
    - [] menu button / siderbar for profile list
    - [] check json folder
    - [] default json choose by latest modidified time
    - []

### Limitation:

clickable event is not working in following cases:
- duplicated func name under the project direct (`a.py::func1` & `b.py::func1`)
- can't redirect to the func that renamed - `import * as *`