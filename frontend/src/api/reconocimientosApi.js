import { request } from './httpClient';

const BASE = '/empl/reconocimientos';

export const createReconocimiento = (datos) => request(BASE, { method: 'POST', body: datos });
