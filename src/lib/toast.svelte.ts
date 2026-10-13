export type ToastKind = 'success' | 'error' | 'info';
export interface Toast { id: number; message: string; kind: ToastKind }
class ToastState {
 items = $state<Toast[]>([]);
 #next = 0;
 show(message: string, kind: ToastKind = 'info', duration = 6000) {
  const id = ++this.#next;
  this.items = [...this.items.slice(-3), { id, message, kind }];
  if (typeof window !== 'undefined' && duration > 0) window.setTimeout(() => this.dismiss(id), duration);
  return id;
 }
 dismiss(id: number) { this.items = this.items.filter((item) => item.id !== id); }
 success(message: string) { return this.show(message, 'success'); }
 error(message: string) { return this.show(message, 'error', 10000); }
}
export const toast = new ToastState();
