import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
const mocks = vi.hoisted(() => ({ user: null as any, rpc: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: mocks.rpc } }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: mocks.user, isReady: true }) }));
vi.mock('@/components/CvUpload', () => ({ default: ({ onParsed }: any) => <button onClick={() => onParsed({})}>Save confirmed CV</button> }));
vi.mock('@/pages/QuickProfile', () => ({ default: ({ onComplete }: any) => <button onClick={onComplete}>Save confirmed Quick Profile</button> }));
import InterviewInvite from '@/pages/InterviewInvite';
function Location() { const l = useLocation(); return <output data-testid="location">{l.pathname}{l.search}</output>; }
function open(path = '/interview/crew-token') { render(<HelmetProvider><MemoryRouter initialEntries={[path]}><Location /><Routes><Route path="/interview/:token" element={<InterviewInvite />} /><Route path="*" element={<p>Destination</p>} /></Routes></MemoryRouter></HelmetProvider>); }
beforeEach(() => { mocks.user = null; mocks.rpc.mockResolvedValue({ data: { ok: true, company: 'Test Maritime', rank: 'Chief Officer', vessel: 'Bulk Carrier', language: 'en' } }); });
afterEach(cleanup);
describe('interview profile preparation', () => {
 it('keeps the same invitation and CV choice through sign-in', async () => {
  open(); fireEvent.click(await screen.findByRole('button', { name: /Upload or Scan My CV/ }));
  expect(screen.getByTestId('location').textContent).toBe('/join?next=%2Finterview%2Fcrew-token%3Fprepare%3Dcv');
 });
 it('keeps the same invitation and Quick Profile choice through sign-in', async () => {
  open(); fireEvent.click(await screen.findByRole('button', { name: /Fill Quick Profile/ }));
  expect(screen.getByTestId('location').textContent).toBe('/join?next=%2Finterview%2Fcrew-token%3Fprepare%3Dquick');
 });
 it('does not start the interview until the CV saver confirms', async () => {
  mocks.user = { id: 'crew' }; open(); fireEvent.click(await screen.findByRole('button', { name: /Upload or Scan My CV/ }));
  const confirm = await screen.findByRole('button', { name: 'Save confirmed CV' });
  expect(screen.getByTestId('location').textContent).toBe('/interview/crew-token?prepare=cv');
  fireEvent.click(confirm); await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/interview/crew-token/exam'));
 });
 it('starts the same interview after Quick Profile confirms saving', async () => {
  mocks.user = { id: 'crew' }; open(); fireEvent.click(await screen.findByRole('button', { name: /Fill Quick Profile/ }));
  fireEvent.click(await screen.findByRole('button', { name: 'Save confirmed Quick Profile' }));
  await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/interview/crew-token/exam'));
 });
 it('preserves the manager-requested second round through sign-in', async () => {
  open('/interview/crew-token?round=2'); fireEvent.click(await screen.findByRole('button', { name: /Upload or Scan My CV/ }));
  expect(screen.getByTestId('location').textContent).toBe('/join?next=%2Finterview%2Fcrew-token%3Fprepare%3Dcv%26round%3D2');
 });
});
