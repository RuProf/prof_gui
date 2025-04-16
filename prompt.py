js_file = 'ui/static/script.js'
css_file = 'ui/static/styles.css'
html_file = 'ui/templates/index.html'
app_file = 'backend/python/app.py'
with open(js_file, 'r') as file:
    js_content = file.read()

with open(css_file, 'r') as file:
    css_content = file.read()

with open(html_file, 'r') as file:
    html_content = file.read()

with open(app_file, 'r') as file:
    app_content = file.read()

prompt = f"""
```{js_file}
{js_content}
```
```{css_file}
{css_content}
```
```{html_file}
{html_content}
```
```{app_file}
{app_content}
```
unchanged file no need to show , if any change , give me the full code please.

mission:
"""
with open('prompt.txt', 'w') as file:
    file.write(prompt)