import re

with open(r'c:\Users\SW교육22\Desktop\Codyssey_8_ProJect\과제_원문.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Remove style tags
html = re.sub(r'<style[^>]*>[\s\S]*?</style>', '', html)
# Remove script tags
html = re.sub(r'<script[^>]*>[\s\S]*?</script>', '', html)
# Remove base64 data
html = re.sub(r'data:image[^\s"]*', '[IMAGE]', html)
# Remove HTML tags but keep text
html = re.sub(r'<[^>]+>', '\n', html)
# Clean up whitespace
html = re.sub(r'\n{3,}', '\n\n', html)
html = re.sub(r'[ \t]+', ' ', html)
# Remove non-printable chars
html = re.sub(r'[\u2060\u200b\ufeff]', '', html)
html = html.strip()

with open(r'c:\Users\SW교육22\Desktop\Codyssey_8_ProJect\extracted_text.txt', 'w', encoding='utf-8') as f:
    f.write(html)

print("Done - file saved")
