// Ponte entre o motor (sem DOM) e a interface.
// A UI substitui estes ganchos no boot; nos testes eles ficam como no-op/síncronos.
export const bus = {
  refresh() {},                  // recalcula a rede e redesenha tudo
  toast() {},                    // (msg, cls)
  animate(step, cb) { cb(); },   // anima um pacote num cabo
  delay(fn) { fn(); },           // (fn, ms)
  term() {},                     // (devId, linha) — nova linha no terminal
  events() {},                   // lista de eventos mudou
  queue() {},                    // fila de simulação mudou
  delDev() {}                    // (devId)
};
