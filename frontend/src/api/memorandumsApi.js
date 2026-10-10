import { request } from './httpClient';

const BASE = '/empl/memorandums';

// `datos` es un FormData: el memorándum viaja como multipart por la evidencia adjunta.
export const createMemorandum = (datos) => request(BASE, { method: 'POST', body: datos });
