
## Release History
V0.1.3
> Feature
- [] netron style
- [] mouse -> previous page button = go to lastFile + lastFunc
> chore

- [] is profile list needed?
    - [] menu button / siderbar for profile list
    - [] check json folder
    - [] default json choose by latest modidified time
    
V0.1.2
> Feature
- [x] merge "collapse" and "expand" button for tree panel
- [x] highlight the row into red if pct of time > 30%
- [x] gear button for setting
- check if `/proile.json` exists
    - [x] exists > load existing `lprof_ext.json` like exisiting script
    - [x] not exists > serverless, drag & drop > save as /lprof_ext.json
- [x] Entrypoint
- [x] gray theme (dark mode)

> chore
- [x] remove line details , 換做func name 
- [x] highlight the cell of pct time instead of row
- [x] highlight the code cell in grey if clickable
- [x] remove col2 clickable
- [x] add hand pointer mouseover clickable code cell
- [x] add hyper formatting clickable code cell in blue font
- [x] backbutton for last page
- [x] trace last page record in list
- [x] modal table view for hierarchy called
- [x] add a button for "collapse" and "expand" button for tree panel
- [x] merge collapse-tree-btn and expand-tree-btn into one button ,  text change to  `+Expand Tree+` and  `-Collapse-`