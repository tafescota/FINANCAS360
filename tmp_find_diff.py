import zipfile, xml.etree.ElementTree as ET, re, sys
NS='{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
def read(path):
 z=zipfile.ZipFile(path); ss=[]
 if 'xl/sharedStrings.xml' in z.namelist():
  root=ET.fromstring(z.read('xl/sharedStrings.xml')); ss=[''.join(t.text or '' for t in si.iter(NS+'t')) for si in root.findall(NS+'si')]
 for name in z.namelist():
  if not re.match(r'xl/worksheets/sheet\d+\.xml$',name): continue
  root=ET.fromstring(z.read(name))
  for row in root.findall('.//'+NS+'row'):
   vals=[]
   for c in row.findall(NS+'c'):
    v=c.find(NS+'v'); q='' if v is None else v.text or ''
    if c.attrib.get('t')=='s' and q: q=ss[int(q)]
    vals.append(q)
   text=' | '.join(vals)
   if any(x in text.lower() for x in ['940000','940.000','sicoob','31/07/2026']): print(name,row.attrib.get('r'),text)
for p in sys.argv[1:]: print('\nFILE',p); read(p)
