"""Apply the source-aligned Indonesian mission revision, retaining stable IDs."""
from pathlib import Path
import json, re

ROOT=Path(__file__).resolve().parents[1]
scripts=ROOT/'scripts'
text={}
for name in ['mission-adult-revision-2026-q4.json','mission-adult-revision-2026-q4-part2.json','mission-adult-revision-2026-q4-part3.json']:
    text.update(json.loads((scripts/name).read_text(encoding='utf-8')))
support=json.loads((scripts/'mission-adult-support-2026-q4.json').read_text(encoding='utf-8'))
adult=ROOT/'content/id/mission-stories/2026-q4-youth-adult'
edition=json.loads((adult/'edition.json').read_text(encoding='utf-8'))
child_state=json.loads((ROOT/'content/id/mission-stories/2026-q4-children/edition.json').read_text(encoding='utf-8'))
if edition['revision']=='6' and child_state['revision']=='8':
    print('Mission revision already applied; canonical text left intact.')
    raise SystemExit(0)
assert edition['revision']=='5' and child_state['revision']=='7', 'Migration requires adult revision 5 and children revision 7; do not overwrite later editorial work.'
assert len(text)==12 and len(support)==13
for node in edition['nodes']:
    path=adult/node['file']; original=path.read_text(encoding='utf-8')
    date=node['readingDate']
    header, name, *_=original.split('\n\n')
    narrative=text.get(date) or original.split('\n\n',2)[2].split('\n### ')[0].strip()
    if date=='2026-10-03' and not narrative.endswith('Terima kasih atas doa dan kemurahan hati Anda bagi pelayanan misi.'):
        narrative+='\n\nTerima kasih atas doa dan kemurahan hati Anda bagi pelayanan misi.'
    nation='Helsinki, Finlandia' if node['country']=='Finlandia' else node['country']
    tips=[f'Tunjukkan lokasi {nation} pada peta.',
          'Lihat foto dan video cerita melalui [Adventist Mission](https://www.facebook.com/missionquarterlies/).',
          f'Bagikan fakta tentang {node["country"]} yang menyertai cerita ini.']
    body=header+'\n\n'+name+'\n\n'+narrative+'\n\n### Tip Cerita\n\n'+'\n\n'.join('- '+s for s in tips)
    for title,bullets in support[date].items(): body+='\n\n### '+title+'\n\n'+'\n\n'.join('- '+s for s in bullets)
    if node['order']==13:
        body+='\n\n### Persiapan Sabat Ketiga Belas\n\n- Ingatkan kelas bahwa persembahan misi mendukung penyebaran firman Tuhan di seluruh dunia. Seperempat Persembahan Sabat Ketiga Belas mendukung empat proyek Divisi Trans-Eropa triwulan ini.\n\n- Penyampai cerita tidak perlu menghafal, tetapi perlu mengenal ceritanya dengan baik.\n\n- Sebelum atau sesudah cerita, tunjukkan Finlandia, Polandia, Kroasia, dan Britania Raya pada peta.\n\n### Proyek Misi Triwulan Berikutnya\n\nTriwulan berikutnya menyoroti Divisi Afrika Tengah-Barat dengan proyek:\n\n- Pusat pengaruh di Prince Emmanuel International Academy, Abidjan, Pantai Gading.\n\n- Klinik kesehatan di Praia, Cabo Verde.\n\n- Prince Emmanuel Children’s School di Bata, Guinea Khatulistiwa.'
    path.write_text(body.strip()+'\n',encoding='utf-8')
edition['revision']='6';edition['audienceIds']=['young-adults','adults']
(adult/'edition.json').write_text(json.dumps(edition,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
child=ROOT/'content/id/mission-stories/2026-q4-children'
edition=json.loads((child/'edition.json').read_text(encoding='utf-8'));assert edition['revision'] in ['7','8']
last=child/edition['nodes'][-1]['file'];body=last.read_text(encoding='utf-8').split('\n### Persiapan Sabat Ketiga Belas')[0]
body+='\n\n### Persiapan Sabat Ketiga Belas\n\n- Ingatkan anak-anak bahwa persembahan misi membantu membagikan firman Tuhan di seluruh dunia. Seperempat Persembahan Sabat Ketiga Belas mendukung empat proyek Divisi Trans-Eropa triwulan ini.\n\n- Penyampai cerita perlu mengenal ceritanya dengan baik, meskipun tidak harus menghafalnya.\n\n- Tunjukkan Finlandia, Polandia, Kroasia, dan Britania Raya pada peta sebelum atau sesudah cerita.\n\n### Proyek Misi Triwulan Berikutnya\n\nTriwulan berikutnya menyoroti Divisi Afrika Tengah-Barat dengan proyek:\n\n- Pusat pengaruh di Prince Emmanuel International Academy, Abidjan, Pantai Gading.\n\n- Klinik kesehatan di Praia, Cabo Verde.\n\n- Prince Emmanuel Children’s School di Bata, Guinea Khatulistiwa.\n'
last.write_text(body,encoding='utf-8');edition['revision']='8'
(child/'edition.json').write_text(json.dumps(edition,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('Adult revision 6: complete narratives and support; children revision 8: quarter closing resources.')
