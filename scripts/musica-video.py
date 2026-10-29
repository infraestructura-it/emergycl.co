# Genera la música original del video (síntesis, sin derechos de terceros).
# Uso: python3 scripts/musica-video.py salida.wav <duraciones de cada sección separadas por coma>
# Música original generada por síntesis (sin derechos de terceros) + efectos de transición
import numpy as np, sys
from scipy.signal import butter, sosfilt
from scipy.io import wavfile
SR=44100
durs=[float(x) for x in sys.argv[2].split(',')]
T=sum(durs); N=int(T*SR); t=np.arange(N)/SR
rng=np.random.default_rng(3)
def lp(x,f,o=2): return sosfilt(butter(o,f,'low',fs=SR,output='sos'),x)
def hp(x,f,o=2): return sosfilt(butter(o,f,'high',fs=SR,output='sos'),x)
def bp(x,a,b): return sosfilt(butter(2,[a,b],'band',fs=SR,output='sos'),x)
def note(n): return 440*2**((n-69)/12)
def clickless(L, a=0.004, r=0.02):
    e=np.ones(L); na=min(L,int(a*SR)); nr=min(L,int(r*SR))
    if na: e[:na]=np.linspace(0,1,na)
    if nr: e[-nr:]*=np.linspace(1,0,nr)
    return e
BPM=96; beat=60/BPM; bar=4*beat
# Am – F – C – G
chords=[[57,60,64],[53,57,60],[48,55,60],[55,59,62]]
roots=[45,41,36,43]
pad=np.zeros(N); bass=np.zeros(N); arp=np.zeros(N); hat=np.zeros(N); kick=np.zeros(N)
nb=int(np.ceil(T/bar))
for b in range(nb):
    c=chords[b%4]; s=int(b*bar*SR); e=min(N,int((b+1)*bar*SR)); L=e-s
    if L<=0: break
    tt=np.arange(L)/SR
    env=np.minimum(1,tt/0.35)*np.minimum(1,(L/SR-tt)/0.35)
    for n in c:
        f=note(n)
        for d in (-0.12,0.12):  # dos osciladores desafinados
            ph=2*np.pi*f*(1+d/100)*tt
            pad[s:e]+=env*(np.sin(ph)+0.35*np.sin(2*ph)+0.12*np.sin(3*ph))
    # bajo en negras con caída suave
    for k in range(4):
        bs=s+int(k*beat*SR); be=min(e,bs+int(beat*SR)); bl=be-bs
        if bl<=0: continue
        tb=np.arange(bl)/SR; f=note(roots[b%4])
        bass[bs:be]+=np.sin(2*np.pi*f*tb)*np.exp(-tb*3.2)*(1 if k%2==0 else .7)*clickless(bl,0.008,0.06)
    # arpegio en corcheas (empieza en el compás 2)
    if b>=1:
        seq=[c[0]+12,c[1]+12,c[2]+12,c[1]+12,c[0]+24,c[2]+12,c[1]+12,c[2]+12]
        for k,n in enumerate(seq):
            a=s+int(k*beat/2*SR); z=min(e,a+int(0.45*SR)); al=z-a
            if al<=0: continue
            ta=np.arange(al)/SR; f=note(n)
            arp[a:z]+=(np.sin(2*np.pi*f*ta)+0.3*np.sin(4*np.pi*f*ta))*np.exp(-ta*9)*clickless(al)
    # ritmo suave desde el compás 3: hi-hat en contratiempo y bombo en 1 y 3
    if b>=2:
        for k in range(8):
            a=s+int((k+0.0)*beat/2*SR); z=min(e,a+int(0.06*SR)); al=z-a
            if al<=0: continue
            hat[a:z]+=rng.standard_normal(al)*np.exp(-np.arange(al)/SR*70)*(1 if k%2 else .45)*clickless(al,0.001,0.01)
        for k in (0,2):
            a=s+int(k*beat*SR); z=min(e,a+int(0.3*SR)); al=z-a
            if al<=0: continue
            tk=np.arange(al)/SR; f=55*np.exp(-tk*18)+42
            kick[a:z]+=np.sin(2*np.pi*np.cumsum(f)/SR)*np.exp(-tk*9)*clickless(al,0.002,0.03)
pad=lp(pad,1400)
hat=lp(hp(hat,7000,4),12000)
arp=lp(arp,3500)
mix=0.11*pad/np.max(np.abs(pad))+0.28*bass/np.max(np.abs(bass))+0.10*arp/max(1e-9,np.max(np.abs(arp)))+0.035*hat/max(1e-9,np.max(np.abs(hat)))+0.22*kick/max(1e-9,np.max(np.abs(kick)))
# efectos: barrido suave de ruido al cambiar de sección y un "tic" cuando entra el rótulo
starts=np.cumsum([0]+durs[:-1])
fx=np.zeros(N)
for i,st in enumerate(starts):
    if i==0: continue
    a=int((st-0.45)*SR); L=int(0.8*SR)
    if a<0 or a+L>N: continue
    tw=np.arange(L)/SR; env=np.sin(np.pi*tw/0.8)**2
    fx[a:a+L]+=bp(rng.standard_normal(L),500,5000)*env*0.05
    if i<len(starts)-1:  # rótulo aparece ~0.3 s después del corte
        c0=int((st+0.32)*SR); cl=int(0.09*SR)
        if c0+cl<N:
            tc=np.arange(cl)/SR
            fx[c0:c0+cl]+=np.sin(2*np.pi*1760*tc)*np.exp(-tc*60)*0.10+np.sin(2*np.pi*2640*tc)*np.exp(-tc*80)*0.05
mix=mix+fx
# entrada y salida
fi=int(1.5*SR); fo=int(3.0*SR)
mix[:fi]*=np.linspace(0,1,fi); mix[-fo:]*=np.linspace(1,0,fo)**1.5
# estéreo: arpegio y hats algo abiertos
left=mix+0.02*np.roll(arp,300)/max(1e-9,np.max(np.abs(arp)))
right=mix+0.02*np.roll(arp,-300)/max(1e-9,np.max(np.abs(arp)))
st=np.stack([left,right],1); st/=np.max(np.abs(st))/0.89
wavfile.write(sys.argv[1],SR,(st*32767).astype(np.int16))
print('ok', T)
