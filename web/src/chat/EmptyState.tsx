export function EmptyState() {
  return (
    <div className="flex flex-col items-start gap-[12px] border-2 border-hard bg-surf p-[28px]">
      <div className="h-[30px] w-[30px] bg-or" />
      <span className="text-[22px] font-extrabold tracking-[-.02em]">
        Manda a imagem aí 👋
      </span>
      <span className="max-w-[52ch] text-[14px] leading-[1.55] text-tx2 text-pretty">
        Anexa uma foto, escreve o que você quer mudar em português normal e eu
        devolvo a versão editada aqui embaixo. Se não gostar, é só pedir de outro
        jeito.
      </span>
    </div>
  );
}
