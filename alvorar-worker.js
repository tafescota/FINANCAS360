/* global XLSX */
importScripts('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');
self.onmessage = event => {
  try {
    const wb = XLSX.read(event.data, { type: 'array', cellDates: true });
    const raw = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: null });
    self.postMessage({ raw, nome: wb.SheetNames[0] });
  } catch (err) { self.postMessage({ erro: err.message }); }
};
