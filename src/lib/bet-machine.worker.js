import {buildMachineTicket} from './bet-machine.js';
self.onmessage=event=>{try{const {candidates,options}=event.data;self.postMessage({ticket:buildMachineTicket(candidates,options)});}catch(error){self.postMessage({error:error instanceof Error?error.message:'Ticket search failed.'});}};
