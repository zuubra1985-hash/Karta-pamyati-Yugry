"""Extract attributed records from the corrected DOCX. Requires python-docx.
Usage: python3 scripts/extract-passports.py /path/to/corrected.docx
Legacy GPS files and personal memoir sections are not imported.
"""
import sys, re, json, hashlib
from pathlib import Path
from docx import Document
from docx.table import Table
source=Path(sys.argv[1]); doc=Document(source); records=[]; current=None; section=None
for node in doc.element.body:
    if node.tag.endswith('}p'):
        text=''.join(t.text or '' for t in node.iter() if t.tag.endswith('}t')).strip()
        match=re.match(r'^№\s*(\d{2})\.\s*(.+?)\s*\(ПАСПОРТ\)$',text)
        if match:
            current={'number':int(match[1]),'title':match[2],'table':{},'context':[],'references':[]};records.append(current);section=None;continue
        if not current:continue
        if text.startswith('6. '):section='context';continue
        if text.startswith(('7. ','8. ')):section=None;continue
        if text.startswith('Указанные составителем источники'):section='references';continue
        if text.startswith('РАЗДЕЛ '):section=None;current=None;continue
        if section and text:current[section].append(text)
    elif node.tag.endswith('}tbl') and current:
        for row in Table(node,doc).rows:
            label,value=[c.text.strip() for c in row.cells[:2]]
            m=re.match(r'^(\d)\.',label)
            if m:current['table'][m[1]]=value
assert len(records)==36, f'Expected 36 passports, got {len(records)}'
items=[]
for r in records:
    t=r['table'];n=r['number'];coord=re.search(r'(\d{2}\.\d+)\s*,\s*(\d{2}\.\d+)',t['2'])
    lat,lon=(float(coord[1]),float(coord[2])) if coord and n!=29 else (None,None)
    period=t['3'];founding=period.split('\n')[0].split('(')[0]
    yearmatch=re.search(r'(?<!\d)(1[5-9]\d{2}|20[0-2]\d)(?!\d)',founding)
    year=int(yearmatch[1]) if yearmatch else None
    title=r['title'];short=re.split(r'\s*\(',title)[0].strip()
    addr=re.sub(r'^.*?\n','',t['2'],count=1) if '\n'in t['2'] else re.sub(r'^\d{2}\.\d+,\s*\d{2}\.\d+\s*','',t['2'])
    if n==29:addr='Местоположение не установлено: в рабочем документе смешаны одноимённые объекты.'
    status='Исторический населённый пункт / слой; правовой статус требует проверки'
    if n in [12,22,26,30]:status='Действующий населённый пункт: изучается отдельный исторический слой'
    elif n in [24,33]:status='Исторический населённый пункт, включённый в городскую территорию'
    elif n==5:status='Дата и правовой акт упразднения не установлены'
    elif n==29:status='Не локализован: в источнике смешаны одноимённые места'
    context='\n\n'.join(r['context'])
    passport={'documentTitle':source.name,'documentUrl':'https://drive.google.com/drive/folders/1-hNPJJAGgjt5ZCww0iakrtA9NXwe1Lls','archiveReference':f'Паспорт № {n:02d}; раздел III, параметры 1–5 и исторический контекст (раздел 6).','officialName':title,'objectType':t['1'],'period':period,'address':addr,'economy':t['4'],'population':t['5'],'historicalStatus':status,'coordinateNote':('Местоположение не установлено. Прежняя точка не используется.' if n==29 else 'G1 / P0: координатная гипотеза из рабочего паспорта. Полевой проверки GPS нет; не для навигации.'),'references':r['references']}
    items.append({'id':f'pas-{n:03d}','catalogue':'surgut-passports-2026-v1','title':short,'location':'Сургутский район и исторические территории','category':'settlements','year':year,'latitude':lat,'longitude':lon,'coordinateStatus':'unknown' if lat is None else 'hypothesis','summary':context.split('\n\n')[0][:190]+'…','story':'Сведения перенесены из историко-краеведческого паспорта, проверенного владельцем проекта.\n\n'+context,'author':'Материалы проекта «Карта памяти Югры»','source':f'{source.name}, паспорт № {n:02d}. Паспорт проверен владельцем проекта 29 октября 2026 года.','image':['village','river','forest'][(n-1)%3],'demo':False,'verificationStatus':'verified','verification':{'by':'project_owner','confirmedOn':'2026-10-29'},'passport':passport})
root=Path(__file__).resolve().parents[1]
(root/'server/data/passports.json').write_text(json.dumps(items,ensure_ascii=False,indent=2)+'\n')
manifest={'sourceFile':source.name,'sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'folder':'https://drive.google.com/drive/folders/1-hNPJJAGgjt5ZCww0iakrtA9NXwe1Lls','count':len(items),'coordinateHypotheses':sum(x['latitude'] is not None for x in items),'unlocated':['pas-029'],'note':'Исправленный рабочий свод. Копии, прежние пакетные редакции и устаревший GPS-атлас не использованы. Разделы воспоминаний и поимённые списки не публикуются без отдельной проверки.'}
manifest['publicDocumentUrl']='https://docs.google.com/document/d/1kE0OX_BCwmxX1CGJBc2IZ_Lvz5d7c2DNK4qMfhUK-wc/edit'
manifest['publicAccessVerified']='2026-10-28'
manifest['ownerVerification']={'by':'project_owner','confirmedOn':'2026-10-29'}
(root/'server/data/passport-sources.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'cards':len(items),'coordinateHypotheses':manifest['coordinateHypotheses'],'withoutExactYear':sum(x['year'] is None for x in items)},ensure_ascii=False))
for x in items: print(x['id'],x['title'],x['year'], 'hypothesis' if x['latitude'] else 'unlocated')
