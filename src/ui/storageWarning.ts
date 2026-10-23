import './storageWarning.css';
import { STORAGE_TEXT } from '../data/storage';

// Persistent banner shown when saves fall back to memory (WP19 T5). DOM only: no Phaser.
// Text is always written with textContent. One banner per root; a second call returns a remover for it.

const WARNING_ID = 'storage-warning';

export function showStorageWarning(root: HTMLElement): () => void {
  const existing = root.querySelector<HTMLElement>(`#${WARNING_ID}`);
  if (existing !== null) return () => existing.remove();

  const banner = document.createElement('div');
  banner.id = WARNING_ID;
  banner.setAttribute('role', 'status');

  const title = document.createElement('strong');
  title.className = 'sw-title';
  title.textContent = STORAGE_TEXT.memoryTitle;

  const body = document.createElement('span');
  body.className = 'sw-body';
  body.textContent = STORAGE_TEXT.memoryBody;

  banner.append(title, body);
  root.appendChild(banner);
  return () => banner.remove();
}
