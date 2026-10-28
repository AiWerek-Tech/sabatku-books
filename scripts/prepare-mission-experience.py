"""Build the quarter companion and sync canonical mission editions to Android.

Keeps existing story IDs and immutable revisions. English readings remain at
Adventech. Run from any directory; --sync copies the published Indonesian texts.
"""
from pathlib import Path
from datetime import datetime
import argparse, hashlib, json, re, shutil

ROOT = Path(__file__).resolve().parents[1]
ANDROID = ROOT.parent / 'sabatku-android/app/src/main/assets'
SOURCE = Path(r'D:\SABATKU-KONTEN\BUKU')
ASSETS = 'https://sabbath-school-resources-assets.adventech.io/en/explore/'

def write(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

def source_stories(role):
    directory, key = ('Berita Misi Dewasa', 'mission-story-readings-2026-04') if role == 'youth-adult' else ('Berita Misi Anak-anak', 'mission-story-readings-2026-04-children')
    result = []
    for file in sorted((SOURCE / directory / key).rglob('*.md')):
        text = file.read_text(encoding='utf-8')
        date = re.search(r'^date:\s*(\d{2}/\d{2}/\d{4})', text, re.M)
        title = re.search(r'^title:\s*(.+)', text, re.M)
        if date:
            day = datetime.strptime(date[1], '%d/%m/%Y').date().isoformat()
            segments = list(file.relative_to(SOURCE / directory / key).parts)
            slug = '-'.join(segments[:-1])
            result.append({'id': 'story-' + day, 'date': day, 'englishTitle': title[1].strip(),
                'englishTextUrl': f'https://sabbath-school.adventech.io/resources/en/explore/{key}/{slug}/{file.stem}',
                'sourceMarkdown': file.relative_to(SOURCE / directory).as_posix()})
    return sorted(result, key=lambda x: x['date'])

def build():
    countries = [
      {'id':'fi','name':'Finlandia','nameEn':'Finland','aliases':['Finlandia'], 'capital':'Helsinki',
       'facts':['Finlandia dikenal dengan nama Suomi dalam bahasa Finlandia.','Finlandia memiliki lebih dari 168.000 danau dan sekitar 179.000 pulau.'],
       'projectIds':['oikos']},
      {'id':'hr','name':'Kroasia','nameEn':'Croatia','aliases':['Kroasia'], 'capital':'Zagreb',
       'facts':['Ibu kota Kroasia adalah Zagreb.','Mata uang Kroasia adalah euro.'], 'projectIds':['prilaz']},
      {'id':'pl','name':'Polandia','nameEn':'Poland','aliases':['Polandia'], 'capital':'Warsawa',
       'facts':['Nama Polandia dalam bahasa Polandia adalah Polska.','Mata uang Polandia adalah złoty.'], 'projectIds':['kompas']},
      {'id':'gb','name':'Britania Raya','nameEn':'United Kingdom','aliases':['Inggris','Britania Raya','Britania Raya (UK)'], 'capital':'London',
       'facts':['United Kingdom mencakup Inggris, Skotlandia, Wales, dan Irlandia Utara.','London adalah ibu kota United Kingdom.'], 'projectIds':['safe-space']},
    ]
    projects = [
      {'id':'oikos','countryId':'fi','title':'Pusat Misi Keluarga OIKOS','location':'Helsinki, Finlandia','description':'Mendukung pendirian pusat misi keluarga dan perintisan jemaat agar lebih banyak orang menemukan komunitas yang peduli.'},
      {'id':'prilaz','countryId':'hr','title':'Pembangunan kembali gereja Prilaz','location':'Zagreb, Kroasia','description':'Mendukung pembangunan kembali gedung gereja Prilaz yang rusak akibat gempa bumi.'},
      {'id':'kompas','countryId':'pl','title':'Perluasan sekolah KOMPAS','location':'Podkowa Leśna, Polandia','description':'Mendukung perluasan sekolah dasar Advent KOMPAS untuk melayani lebih banyak anak dan keluarga.'},
      {'id':'safe-space','countryId':'gb','title':'Ruang aman bagi anak dan pemuda','location':'Inggris, Britania Raya','description':'Mendukung ruang pendampingan di sekolah-sekolah komunitas bagi anak dan pemuda yang membutuhkan seseorang untuk mendengarkan dan menolong mereka.'},
    ]
    activities = [
      {'id':'licitar','countryId':'hr','title':'Membuat hati Licitar','kind':'Prakarya','duration':'20–30 menit', 'adultHelp':True,
       'materials':['Kertas tebal atau karton','Gunting','Spidol atau cat merah dan warna lain'],
       'steps':['Gambar hati berukuran sekitar 10–15 cm pada kertas tebal.','Minta orang dewasa membantu mengguntingnya. Warnai merah dan biarkan kering.','Hias dengan pola berwarna. Tuliskan nama orang yang ingin kamu beri hati itu.'],
       'sourcePages':[30]},
      {'id':'flags','countryId':'all','title':'Mewarnai bendera','kind':'Mewarnai','duration':'15–20 menit','adultHelp':False,
       'materials':['Lembar bendera dari sumber','Pensil warna merah, biru, dan kuning'],
       'steps':['Pilih bendera Finlandia, Kroasia, Polandia, atau Britania Raya dari lembar sumber.','Baca petunjuk warna bersama pendamping. Perhatikan letak salib, garis, dan lambangnya.','Temukan negara tersebut pada peta dan baca cerita misinya.'], 'sourcePages':[31,32]},
      {'id':'carrots','countryId':'fi','title':'Mengenal porkkanalaatikko','kind':'Memasak bersama','duration':'Sekitar 2 jam','adultHelp':True,
       'materials':['Resep lengkap dari sumber','Beras, susu, wortel, telur, dan bahan lain sesuai resep'],
       'steps':['Baca resep lengkap bersama orang dewasa. Periksa bahan yang sesuai bagi keluarga.','Orang dewasa menangani kompor, pisau, dan oven. Anak dapat membantu mengukur dan mencampur bahan yang sudah aman.','Siapkan nasi, campurkan bahan, lalu panggang sesuai resep. Tunggu hingga cukup dingin sebelum dinikmati.'], 'sourcePages':[33]},
      {'id':'words','countryId':'gb','title':'Satu bahasa, kata yang berbeda','kind':'Permainan bahasa','duration':'10–15 menit','adultHelp':False,
       'materials':['Kertas dan pensil'],
       'steps':['Buat pasangan kartu: truck–lorry, cookie–biscuit, elevator–lift, vacation–holiday, dan flashlight–torch.','Cocokkan kata Inggris Amerika dengan kata Inggris Britania yang bermakna sama.','Ceritakan perbedaan kata yang kamu kenal dalam bahasa atau daerahmu sendiri.'], 'sourcePages':[34]},
      {'id':'pomidor','countryId':'pl','title':'Pomidor: jawablah “tomat”!','kind':'Permainan kelompok','duration':'10–15 menit','adultHelp':True,
       'materials':['Beberapa teman dan pendamping'],
       'steps':['Seorang penanya bergiliran mengajukan pertanyaan yang sopan dan menyenangkan.','Semua jawaban harus “tomat”. Cobalah menjawab tanpa tertawa.','Jika tertawa, lakukan tantangan ringan yang disepakati, seperti menghitung mundur atau menyanyi. Pastikan semua anak nyaman dan boleh berhenti.'], 'sourcePages':[34]},
    ]
    data = {'schemaVersion':1,'revision':1,'id':'mission:2026-q4','year':2026,'quarter':4,'locale':'id',
      'region':'Divisi Trans-Eropa','startDate':'2026-10-03','endDate':'2026-12-26',
      'countries':countries,'projects':projects,'activities':activities,
      'preparation':['Baca cerita dan kenali nama serta tempatnya sebelum menyampaikan.','Siapkan foto, peta, dan bahan pendamping yang relevan.','Kenalkan tokoh dan lokasinya, lalu sampaikan cerita dengan jelas.','Hubungkan penutup cerita dengan proyek misi dan ajak kelas berdoa.','Menjelang Sabat ke-13, siapkan kelas untuk Persembahan Sabat Ketiga Belas.'],
      'together':['Bacakan dengan tenang dan beri anak kesempatan bertanya.','Untuk anak yang lebih muda, jelaskan nama tempat dan kata yang belum dipahami.','Untuk anak yang lebih besar, ajak mereka menemukan hubungan cerita dengan pelayanan dan kepedulian.','Gunakan Tip Cerita dari sumber untuk menyiapkan penyampaian.'],
      'prayer':'Berdoalah bagi tokoh dalam cerita, anak-anak dan keluarga di wilayah ini, serta mereka yang melayani di sana.',
      'resources':[
       {'id':'spotlight','title':'Mission Spotlight · video resmi','url':'https://adventistmission.org/mission-awareness/mission-spotlight','language':'en','format':'video'},
       {'id':'photos','title':'Foto dan video cerita · Adventist Mission','url':'https://www.facebook.com/missionquarterlies/','language':'en','format':'website'},
       {'id':'map','title':'Peta Divisi Trans-Eropa','url':ASSETS+'mission-story-readings-2026-04/05-map/map.pdf','language':'en','format':'pdf'},
       {'id':'activities','title':'Lembar aktivitas anak','url':ASSETS+'mission-story-readings-2026-04-children/04-activities/activities.pdf','language':'en','format':'pdf'},
       {'id':'division','title':'Divisi Trans-Eropa · situs resmi','url':'https://ted.adventist.org','language':'en','format':'website'},
       {'id':'croatia','title':'Gereja Advent di Kroasia','url':'https://www.adventisti.hr','language':'hr','format':'website'},
       {'id':'finland','title':'Gereja Advent di Finlandia','url':'https://www.adventist.fi','language':'fi','format':'website'},
       {'id':'poland','title':'Gereja Advent di Polandia','url':'https://adwent.pl','language':'pl','format':'website'},
       {'id':'britain','title':'Gereja Advent di Britania Raya','url':'https://www.adventist.uk','language':'en','format':'website'}],
      'stories':{r:source_stories(r) for r in ['children','youth-adult']},
      'editorial':{'statistics':'Omitted from country cards pending reconciliation: Finland 4063 (story) vs 4115 (map); Poland 6032 (story) vs 5995 (map).',
        'activityAdaptations':['Duration estimates, adult supervision, and inclusive Pomidor ending are SabatKu companion guidance.'],
        'sources':['mqc26q4.pdf pp. 3, 29–36','mqa26q4.pdf pp. 3, 30–32']}}
    for role, stories in data['stories'].items():
        assert len(stories)==13 and len({s['date'] for s in stories})==13
    for role, stories in data['stories'].items():
        edition_root=ROOT/f'content/id/mission-stories/2026-q4-{role}'
        for story in stories:
            body=(edition_root/'nodes'/f'{story["id"]}.md').read_text(encoding='utf-8').split('\n### ')[0]
            story['readingMinutes']=max(1,(len(re.findall(r'\w+',body))+159)//160)
    write(ROOT/'mission/2026-q4.json',data)
    return data

def sync():
    index=json.loads((ANDROID/'mission-stories/index.json').read_text(encoding='utf-8'))
    for role in ['children','youth-adult']:
        source=ROOT/f'content/id/mission-stories/2026-q4-{role}'
        edition=json.loads((source/'edition.json').read_text(encoding='utf-8'))
        item=next(x for x in index['editions'] if x['book']['id']==edition['id'])
        revision=edition['revision']; prefix=f'mission-stories/2026-q4-{role}/revisions/{revision}'
        old=item['book']['revision']
        item['book'].update(revision=revision, audienceIds=edition['audienceIds'])
        item['coverAssetPath']=f'{prefix}/assets/cover.jpg'
        for chapter in item['chapters']:
            node=next(n for n in edition['nodes'] if n['id']==chapter['id'])
            raw=(source/node['file']).read_bytes()
            chapter.update(title=node['title'], bytes=len(raw),sha256=hashlib.sha256(raw).hexdigest(),
               contentAssetPath=f'{prefix}/nodes/{chapter["id"]}.md',imageAssetPath=f'{prefix}/assets/{chapter["id"]}.jpg')
        for folder in ['nodes','assets']:
            target=ANDROID/prefix/folder; target.mkdir(parents=True, exist_ok=True)
            for f in (source/folder).iterdir():
                if f.is_file():
                    dest=target/f.name
                    if dest.exists() and dest.read_bytes()!=f.read_bytes():
                        raise ValueError('Bump edition revision before changing bundled content: '+str(dest))
                    shutil.copyfile(f,dest)
    write(ANDROID/'mission-stories/index.json',index)
    write(ANDROID/'mission/2026-q4.json',json.loads((ROOT/'mission/2026-q4.json').read_text(encoding='utf-8')))

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--sync',action='store_true');args=parser.parse_args()
    build()
    if args.sync:sync()
    print('Mission quarter prepared'+(' and Android assets synchronized' if args.sync else ''))
