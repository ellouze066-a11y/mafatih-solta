import {firebaseConfig} from './cloud-config.js?v=cloud2';
const key='civic_game_v4';export const cloud=!!firebaseConfig&&!new URLSearchParams(location.search).has('local');
let fb=null,uid=null,loading=null;
async function sdk(){
 if(fb)return fb;
 if(!loading)loading=(async()=>{
  const [app,auth,fs]=await Promise.all([import('https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js'),import('https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js'),import('https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js')]);
  const instance=app.getApps().length?app.getApp():app.initializeApp(firebaseConfig);
  const a=auth.getAuth(instance);await auth.setPersistence(a,auth.browserSessionPersistence);
  await a.authStateReady();if(!a.currentUser)await auth.signInAnonymously(a);
  uid=a.currentUser.uid;return fb={fs,db:fs.getFirestore(instance)};
 })().catch(e=>{loading=null;throw e});
 return loading;
}
export function message(e){const c=e?.code||'';if(c.includes('permission-denied'))return 'تعذّر الوصول إلى الحصة. افتحها من نافذة الأستاذ الأصلية أو أنشئ حصة جديدة.';if(c.includes('network')||c.includes('unavailable'))return 'تعذّر الاتصال. تحقّق من الإنترنت، أو استعمل وضع العرض الاحتياطي.';return e?.message||'تعذّرت العملية. حاول مجددًا.'}
export const id=()=>uid;
export const initial=()=>({stage:0,phase:'lobby',code:'',owner:'',teams:{},submissions:{},updated:Date.now()});
export async function createRoom(){const code=Math.random().toString(36).slice(2,8).toUpperCase();if(cloud){const {fs,db}=await sdk();const state={...initial(),code,owner:uid};await fs.setDoc(fs.doc(db,'rooms',code),state)}else{const state={...initial(),code,owner:'local'};localStorage.setItem(key,JSON.stringify(state))}return code}
export async function readRoom(code){if(cloud){const {fs,db}=await sdk();const snap=await fs.getDoc(fs.doc(db,'rooms',code));return snap.exists()?snap.data():null}const x=JSON.parse(localStorage.getItem(key)||'null');return x?.code===code?x:null}
export async function changeRoom(code,patch){if(cloud){const {fs,db}=await sdk();await fs.updateDoc(fs.doc(db,'rooms',code),{...patch,updated:Date.now()})}else{const x=await readRoom(code);if(!x)throw Error('الغرفة غير موجودة');localStorage.setItem(key,JSON.stringify({...x,...patch,updated:Date.now()}));window.dispatchEvent(new Event('storage'))}}
export async function join(code,name){const x=await readRoom(code);if(!x)throw Error('رمز غير صحيح');if(cloud){const {fs,db}=await sdk();const ref=fs.doc(db,'rooms',code,'teams',uid);const existing=await fs.getDoc(ref);if(!existing.exists())await fs.setDoc(ref,{name,score:0,joined:Date.now()});return uid}const tid='team_'+name.trim();x.teams[tid]??={name,score:0,joined:Date.now()};await changeRoom(code,{teams:x.teams});return tid}
export async function sendAnswer(code,teamId,stage,option,reason){const room=await readRoom(code);if(!room||room.phase!=='open'||room.stage!==stage)throw Error('انتهى استقبال الإجابات لهذا التحدّي');if(cloud){const {fs,db}=await sdk();await fs.setDoc(fs.doc(db,'rooms',code,'submissions',teamId+'_'+stage),{teamId,stage,option,reason,submitted:Date.now()})}else{const x=await readRoom(code);x.submissions[teamId+'_'+stage]={teamId,stage,option,reason,submitted:Date.now()};await changeRoom(code,{submissions:x.submissions})}}
export async function setScore(code,teamId,score){if(cloud){const {fs,db}=await sdk();await fs.updateDoc(fs.doc(db,'rooms',code,'teams',teamId),{score})}else{const x=await readRoom(code);x.teams[teamId].score=score;await changeRoom(code,{teams:x.teams})}}
export function watch(code,callback,onError=console.error){if(cloud){let stops=[],state=null,teams={},subs={},cancelled=false;sdk().then(({fs,db})=>{if(cancelled)return;const emit=()=>{if(state)callback({...state,teams,submissions:subs})};stops=[fs.onSnapshot(fs.doc(db,'rooms',code),s=>{state=s.exists()?s.data():null;if(!state)onError(Error('الحصة غير موجودة. أنشئ حصة جديدة.'));emit()},onError),fs.onSnapshot(fs.collection(db,'rooms',code,'teams'),s=>{teams=Object.fromEntries(s.docs.map(d=>[d.id,d.data()]));emit()},onError),fs.onSnapshot(fs.collection(db,'rooms',code,'submissions'),s=>{subs=Object.fromEntries(s.docs.map(d=>[d.id,d.data()]));emit()},onError)]}).catch(onError);return()=>{cancelled=true;stops.forEach(fn=>fn())}}let running=true;const poll=async()=>{if(running)callback(await readRoom(code))};poll();const timer=setInterval(poll,1200);return()=>{running=false;clearInterval(timer)}}
