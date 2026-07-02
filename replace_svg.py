with open('index.html', 'r') as f:
    html = f.read()

with open('svg_replacement.html', 'r') as f:
    svg_block = f.read()

start_marker = '                  <div class="body-map-wrapper" id="bodyMapWrapper">'
end_marker = '                  <!-- Подзоны (выезжают при выборе зоны) -->'

start_idx = html.find(start_marker)
end_idx = html.find(end_marker)

new_html = html[:start_idx] + svg_block + "\n" + html[end_idx:]

with open('index.html', 'w') as f:
    f.write(new_html)
print("Replaced!")
