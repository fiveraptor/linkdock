export function fakeBookmarks(){
 const records=new Map([['0',{id:'0',title:'',children:['1','2']}],['1',{id:'1',parentId:'0',title:'Lesezeichenleiste',folderType:'bookmarks-bar',children:[]}],['2',{id:'2',parentId:'0',title:'Andere Lesezeichen',children:[]}]]);
 let next=10,count=0,failAt=null,failAfter=false;
 const event=()=>{const callbacks=[];return {addListener:fn=>callbacks.push(fn),emit:(...args)=>callbacks.forEach(fn=>fn(...args))};};
 const events=Object.fromEntries(['onCreated','onChanged','onMoved','onRemoved','onChildrenReordered','onImportBegan','onImportEnded'].map(name=>[name,event()]));
 function get(id){const r=records.get(id);if(!r)throw Error('Missing node '+id);return r;}
 function view(id,deep=false){const r=get(id);const {children,...props}=r;return {...props,...(r.parentId?{index:get(r.parentId).children.indexOf(id)}:{}),...(deep&&children?{children:children.map(id=>view(id,true))}:{})};}
 function failure(){count++;if(count===failAt&&!failAfter)throw Error('Simulated Chrome write failure');}
 const api={...events,
  getTree:async()=>[view('0',true)],get:async id=>[view(id)],getChildren:async id=>get(id).children.map(id=>view(id)),
  async create(input){failure();const parent=get(input.parentId);const id=String(next++);records.set(id,{id,parentId:parent.id,title:input.title,...(input.url?{url:new URL(input.url).href}:{children:[]})});parent.children.splice(input.index??parent.children.length,0,id);events.onCreated.emit(id,view(id));if(count===failAt&&failAfter)throw Error('Simulated lost create response');return view(id);},
  async update(id,update){failure();Object.assign(get(id),update,...(update.url?[{url:new URL(update.url).href}]:[]));events.onChanged.emit(id,update);return view(id);},
  async move(id,destination){failure();const r=get(id);const parentId=destination.parentId||r.parentId;let ancestor=parentId;while(ancestor){if(ancestor===id)throw Error('Cycle');ancestor=get(ancestor).parentId;}const oldParentId=r.parentId;const old=get(oldParentId).children;old.splice(old.indexOf(id),1);r.parentId=parentId;const children=get(parentId).children;children.splice(destination.index??children.length,0,id);events.onMoved.emit(id,{parentId,oldParentId,index:children.indexOf(id)});return view(id);},
  async remove(id){failure();const r=get(id);if(r.children?.length)throw Error('Folder not empty');get(r.parentId).children.splice(get(r.parentId).children.indexOf(id),1);records.delete(id);events.onRemoved.emit(id,{parentId:r.parentId,node:viewRaw(r)});},
  failNext(after=false){failAt=count+1;failAfter=after;},clearFailure(){failAt=null;},writes:()=>count,records
 };
 function viewRaw(record){return structuredClone(record);}
 return api;
}
