// pdf.js versi baru memakai Map.getOrInsertComputed yang belum ada di semua browser
for (const C of [Map, WeakMap]) {
  if (!C.prototype.getOrInsertComputed) C.prototype.getOrInsertComputed = function (k, f) { if (this.has(k)) return this.get(k); const v = f(k); this.set(k, v); return v; };
  if (!C.prototype.getOrInsert) C.prototype.getOrInsert = function (k, v) { if (this.has(k)) return this.get(k); this.set(k, v); return v; };
}
export default true;
