import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const m=vi.hoisted(()=>({invoke:vi.fn(),from:vi.fn(),upload:vi.fn()}));
vi.mock('@/contexts/AuthContext',()=>({useAuth:()=>({user:{id:'crew'},accessToken:'test'})}));
vi.mock('@/integrations/supabase/client',()=>({supabase:{functions:{invoke:m.invoke},from:m.from,storage:{from:()=>({upload:m.upload})}}}));
vi.mock('@/lib/analytics',()=>({trackEvent:vi.fn()}));
vi.mock('@/lib/logEvent',()=>({logEvent:vi.fn()}));
import CvUpload from '@/components/CvUpload';
afterEach(cleanup);
beforeEach(()=>{vi.clearAllMocks();m.invoke.mockResolvedValue({data:{success:true,data:{name:'Test Crew',rank:'Chief Officer',sea_service:[{vessel_name:'TEST',vessel_type:'Bulk Carrier'}],certificates:[]}}});m.upload.mockResolvedValue({error:null});});
it('does not proceed when saving the scanned CV fails',async()=>{
 const proceed=vi.fn();m.from.mockReturnValue({select:()=>({eq:()=>({maybeSingle:async()=>({data:null})})}),upsert:()=>({select:()=>({single:async()=>({error:new Error('offline')})})})});
 const {container}=render(<CvUpload onParsed={proceed}/>);
 fireEvent.change(container.querySelector('input[type=file]') as HTMLInputElement,{target:{files:[new File(['test'],'cv.png',{type:'image/png'})]}});
 fireEvent.click(await screen.findByRole('button',{name:/Confirm & Proceed/}));
 await screen.findByRole('alert');expect(proceed).not.toHaveBeenCalled();
});
it('advances only after confirmed CV and profile saves',async()=>{
 const proceed=vi.fn();m.from.mockReturnValue({select:()=>({eq:()=>({maybeSingle:async()=>({data:null})})}),upsert:()=>({select:()=>({single:async()=>({data:{user_id:'crew'},error:null})})}),update:()=>({eq:()=>({select:()=>({single:async()=>({data:{id:'crew'},error:null})})})})});
 const {container}=render(<CvUpload onParsed={proceed}/>);
 fireEvent.change(container.querySelector('input[type=file]') as HTMLInputElement,{target:{files:[new File(['test'],'cv.png',{type:'image/png'})]}});
 fireEvent.click(await screen.findByRole('button',{name:/Confirm & Proceed/}));
 await waitFor(()=>expect(proceed).toHaveBeenCalledOnce());expect(m.upload).toHaveBeenCalledOnce();
});
