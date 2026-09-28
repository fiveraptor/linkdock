import assert from 'node:assert/strict';
import {serverAddress,serverOrigin} from '../dist/chrome/server-address.mjs';
assert.equal(serverAddress(' https://LINKDOCK.example.com/ '),'https://linkdock.example.com');
assert.equal(serverAddress('http://localhost:3000/path/'),'http://localhost:3000/path');
assert.equal(serverOrigin('https://other.example:8443/linkdock'),'https://other.example/*');
assert.equal(serverOrigin('http://localhost:3000'),'http://localhost/*');
for(const bad of ['linkdock.example.com','ftp://host/','https://user:secret@host/','https://host/?token=secret','https://host/#part','javascript:alert(1)'])assert.throws(()=>serverAddress(bad),bad);
console.log('PASS: free server URL, custom ports/base paths, origin permissions, invalid schemes and embedded credentials rejected.');
