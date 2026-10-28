from pathlib import Path
import random, math
root=Path(__file__).resolve().parents[1]/'public/images'
random.seed(86)
def trees(y, count, color, lo, hi):
    out=''
    for _ in range(count):
        x=random.uniform(-20,1240); h=random.uniform(lo,hi); w=h*.25
        out+=f'<path d="M{x:.0f} {y-h:.0f}l{-w:.0f} {h*.7:.0f}h{w*.43:.0f}l{-w*.65:.0f} {h*.24:.0f}h{w*2.45:.0f}l{-w*.65:.0f} {-h*.24:.0f}h{w*.43:.0f}Z" fill="{color}"/>'
    return out
hero=f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 720"><defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="#cbbd99"/><stop offset="1" stop-color="#ede2c8"/></linearGradient><linearGradient id="water" x2="1" y2="1"><stop stop-color="#c4ba9a"/><stop offset="1" stop-color="#728d86"/></linearGradient><filter id="grain"><feTurbulence type="fractalNoise" baseFrequency=".72" numOctaves="3" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="linear" slope=".11"/></feComponentTransfer><feBlend in="SourceGraphic" mode="multiply"/></filter></defs><g filter="url(#grain)"><path fill="url(#sky)" d="M0 0h1200v720H0z"/><circle cx="884" cy="159" r="56" fill="#f3e7c3" opacity=".75"/><path d="M0 270L130 238 250 267 490 190 690 256 890 218 1200 266V520H0Z" fill="#9da38c"/><path d="M0 307Q250 240 540 310T1200 284V720H0" fill="#64796b"/>{trees(348,120,'#435f50',20,80)}<path d="M680 308C560 355 878 378 745 420S366 490 516 577S1030 650 1250 720H0V650C60 555 350 532 453 478S660 398 604 371S578 334 665 308Z" fill="url(#water)"/><path d="M0 365Q202 342 340 404T484 472L0 613Z" fill="#395646"/>{trees(432,65,'#2d4b3d',38,130)}<path d="M1200 390Q950 388 842 466T680 554L1200 687Z" fill="#304e40"/>{trees(515,65,'#243f33',40,145)}<path d="M0 636Q235 561 417 624T690 720H0Z" fill="#233f32"/>{trees(710,35,'#19372b',60,180)}<path d="M528 517q90 5 156-18M537 529q40 3 94-8M739 433q57-6 87-14" stroke="#e0d4b0" stroke-width="2" fill="none" opacity=".4"/><g fill="#263e33"><path d="M800 127q12-11 22 0-10-5-11 1-1-5-11-1M834 113q8-8 16 0-8-3-8 1-1-4-8-1"/></g></g></svg>'''
(root/'hero.svg').write_text(hero)
for theme in ['village','river','forest']:
    random.seed(86)
    base=f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 600"><defs><filter id="paper"><feTurbulence type="fractalNoise" baseFrequency=".7" numOctaves="3"/><feComponentTransfer><feFuncA type="linear" slope=".12"/></feComponentTransfer><feBlend in="SourceGraphic" mode="multiply"/></filter></defs><g filter="url(#paper)"><path fill="#d6c6a6" d="M0 0h900v600H0z"/><circle cx="710" cy="115" r="42" fill="#eaddbf"/><path d="M0 260Q150 190 380 260T900 240V600H0Z" fill="#a6a18c"/>'
    if theme=='village':
        base+='<path fill="#c1b08f" d="M0 390h900v210H0z"/><path d="M280 600L455 350h80l170 250" fill="#d9c6a0"/>'
        for x,y,s in [(40,315,1.2),(220,345,.8),(620,300,1.3),(515,340,.65)]:
            base+=f'<g transform="translate({x} {y}) scale({s})"><path d="M0 0h140v105H0Z" fill="#776c55"/><path d="M-18 0l85-67L158 0Z" fill="#514f41"/><path d="M0 20h140M0 40h140M0 60h140M0 80h140" stroke="#9f9072" stroke-width="3"/><path d="M19 19h25v33H19zm65 0h25v33H84z" fill="#d6c6a0" stroke="#b2a17d" stroke-width="5"/><path d="M116-40v-37h13v50" fill="#665c49"/></g>'
    elif theme=='river':
        base+='<path d="M0 350q150-40 440-9T900 300v300H0Z" fill="#a4a898"/><path d="M0 400q250-30 430 6t470-10M0 470q250-30 430 6t470-10M0 540q250-30 430 6t470-10" stroke="#c9c8b0" fill="none"/><path d="M65 600L270 355h55L235 600" fill="#82785e"/><path d="M225 443l30-38h84l-10 16Z" fill="#4c5449"/>'
    else:
        base+='<path d="M0 360L250 190 400 330 560 130 900 360v240H0Z" fill="#8c9481"/><path d="M560 130l-90 110 70-22 20 30 28-23 50 28Z" fill="#d5cdb5"/><path d="M410 380q-70 90-230 220h300q-120-120-40-220Z" fill="#b9bda8"/>'
    base+=trees(580,30,'#58634f',50,150)+'</g></svg>'
    (root/f'{theme}.svg').write_text(base)
# A self-contained, deliberately schematic map, georeferenced using Mercator.
def xy(lat,lon):
    merc=lambda lat: math.log(math.tan(math.pi/4+math.radians(lat)/2))
    return ((lon-58)/28*1400,(merc(67)-merc(lat))/(merc(67)-merc(58))*1000)
def path(coords):
    return 'M'+' L'.join(f'{xy(a,b)[0]:.1f} {xy(a,b)[1]:.1f}' for a,b in coords)
out='<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="1000" viewBox="0 0 1400 1000"><defs><pattern id="land" width="38" height="38" patternUnits="userSpaceOnUse"><path d="M10 25l5-9 5 9zm16 10l3-6 3 6z" fill="#c6cdb5" opacity=".55"/></pattern></defs><path fill="#e7e8d9" d="M0 0h1400v1000H0z"/><path fill="#d9dfc9" d="M0 0h510l-60 190 120 140-180 130 60 280-170 260H0Z"/><path fill="url(#land)" d="M0 0h1400v1000H0z"/>'
for c in [[(58.8,68.7),(60,69.6),(61,69.1),(61.2,70.7),(61.6,71.2),(61.3,72.3),(61.25,73.5),(61.05,75.2),(60.9,76.5),(61.3,79.8)],[(61,69.1),(61.5,67.8),(62.2,65.8),(63.3,65.1),(63.94,65.04),(65,65.8),(66.3,66.5)],[(59,69),(59.7,68.5),(60.97,69.07)],[(64.3,60.9),(63.8,62),(63.5,63.6),(63.6,65.2)],[(60.5,74),(61,73.7),(61.25,73.5)],[(59.6,67.4),(60,66.6),(60.3,67.8),(60.8,69)]]:
    d=path(c); out+=f'<path d="{d}" stroke="#bbcdd0" stroke-width="15" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="{d}" stroke="#d6e2df" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'
for lat,lon,text in [(62.4,69.3,'Ю Г Р А'),(62.8,64.8,'Обь'),(60.3,69,'Иртыш'),(64,60,'ПРИПОЛЯРНЫЙ УРАЛ')]:
    x,y=xy(lat,lon); out+=f'<text x="{x}" y="{y}" font-family="Georgia,serif" font-size="{28 if text.startswith("Ю") else 15}" fill="#7a8d7c" letter-spacing="3">{text}</text>'
out+='</svg>'; (root/'map.svg').write_text(out)

# A second, explicitly fictional view for the before/after demonstration.
modern = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 600"><path fill="#d8e1d0" d="M0 0h900v600H0z"/><circle cx="710" cy="115" r="42" fill="#f4eccd"/><path d="M0 260Q150 190 380 260T900 240V600H0Z" fill="#a5b89e"/><path fill="#97ab87" d="M0 390h900v210H0z"/><path d="M280 600L455 350h80l170 250" fill="#c4c6b8"/><path d="M492 350L484 600" stroke="#efe9d2" stroke-width="3" stroke-dasharray="15 20"/>'
for x,y,scale in [(40,315,1.2),(220,345,.8),(620,300,1.3),(515,340,.65)]:
    modern+=f'<g transform="translate({x} {y}) scale({scale})"><path d="M0 0h140v105H0Z" fill="#e5dac1"/><path d="M-18 0l85-67L158 0Z" fill="#6f775b"/><path d="M19 19h25v33H19zm65 0h25v33H84z" fill="#a8c5c1" stroke="#f5ebd6" stroke-width="5"/><path d="M116-40v-37h13v50" fill="#827d63"/><path d="M0 80h140" stroke="#a8ab91" stroke-width="5"/></g>'
modern+='<path d="M360 370v100m0-100h35m-35 100v55m230-135v90m-30-90h30" stroke="#748571" stroke-width="5"/><path d="M348 525h25m218-45h25" stroke="#566b57" stroke-width="4"/><path d="M55 505h200m-175-15v40m65-40v40m65-40v40" stroke="#d0c9b4" stroke-width="7"/></svg>'
(root/'village-now.svg').write_text(modern)
