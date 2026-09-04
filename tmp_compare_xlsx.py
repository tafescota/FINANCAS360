import zipfile, xml.etree.ElementTree as ET, re, sys, datetime

NS='{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
def read(path):
    z=zipfile.ZipFile(path)
    ss=[]
    if 'xl/sharedStrings.xml' in z.namelist():
        root=ET.fromstring(z.read('xl/sharedStrings.xml'))
        for si in root.findall(NS+'si'):
            ss.append(''.join(t.text or '' for t in si.iter(NS+'t')))
    out=[]
    for name in sorted(n for n in z.namelist() if re.match(r'xl/worksheets/sheet\d+\.xml$',n)):
        root=ET.fromstring(z.read(name)); rows=[]
        for row in root.findall('.//'+NS+'row'):
            d={}
            for c in row.findall(NS+'c'):
                ref=c.attrib.get('r',''); col=re.sub(r'\d','',ref)
                v=c.find(NS+'v'); val='' if v is None else (v.text or '')
                if c.attrib.get('t')=='s' and val: val=ss[int(val)]
                d[col]=val
            rows.append(d)
        out.append((name,rows))
    return out
def num(x):
    try:return float(x)
    except:return 0.0
for path in sys.argv[1:]:
    print('\nFILE',path)
    total=0; count=0
    for sh,rows in read(path):
        hrow=None; hcol=None
        for i,r in enumerate(rows):
            for c,v in r.items():
                if 'Valor Líquido' in str(v) or 'Valor Liquido' in str(v): hrow=i; hcol=c; break
            if hrow is not None: break
        if hrow is None:
            for i,r in enumerate(rows):
                for c,v in r.items():
                    if 'Valor Bruto' in str(v): hrow=i; hcol=c; break
                if hrow is not None: break
        if hrow is not None:
            s=sum(num(r.get(hcol,'')) for r in rows[hrow+1:]); n=sum(1 for r in rows[hrow+1:] if r.get(hcol,'')!='')
            print(sh,'header_row',hrow+1,'col',hcol,'rows',n,'sum',f'{s:,.2f}')
            total+=s; count+=n
    print('TOTAL',count,f'{total:,.2f}')
