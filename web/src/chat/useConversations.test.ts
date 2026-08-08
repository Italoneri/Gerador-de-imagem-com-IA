import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ok, err } from "../result.js";
import type { ValidatedImage } from "../upload/validateImageFile.js";
import { isDoneMessage, type ChatMessage } from "./types.js";
import { useConversations } from "./useConversations.js";

vi.mock("../api/editImage.js", () => ({ editImage: vi.fn() }));
// IndexedDB não existe no jsdom; o histórico não é o alvo destes testes.
vi.mock("../storage/history.js", () => ({
  loadConversations: vi.fn().mockResolvedValue([]),
  saveConversations: vi.fn().mockResolvedValue(undefined),
}));

const { editImage } = await import("../api/editImage.js");
const editImageMock = vi.mocked(editImage);

const attachment = (name = "foto.png"): ValidatedImage => ({
  blob: new Blob(["origem"], { type: "image/png" }),
  name,
  mimeType: "image/png",
  width: 800,
  height: 600,
});

type EditOutcome = Awaited<ReturnType<typeof editImage>>;

const succeedsWith = (marker: string): EditOutcome =>
  ok({ blob: new Blob([marker], { type: "image/png" }), mimeType: "image/png" });

/** Renderiza o hook já hidratado, para os efeitos não competirem com o teste. */
async function setup() {
  const view = renderHook(() => useConversations());
  await waitFor(() => expect(view.result.current.active).toBeDefined());
  return view;
}

const messagesOf = (messages: readonly ChatMessage[]) =>
  messages.map((message) =>
    message.kind === "user" ? "user" : `ai:${message.state}`,
  );

async function send(
  view: Awaited<ReturnType<typeof setup>>,
  prompt: string,
  file: ValidatedImage | null,
) {
  await act(async () => {
    view.result.current.send({ prompt, attachment: file });
  });
}

beforeEach(() => {
  editImageMock.mockReset();
  editImageMock.mockResolvedValue(succeedsWith("v1"));
});

describe("send", () => {
  it("acrescenta a mensagem do usuário e o balão de carregando antes da resposta", async () => {
    let resolveEdit!: (outcome: EditOutcome) => void;
    editImageMock.mockReturnValue(
      new Promise<EditOutcome>((resolve) => {
        resolveEdit = resolve;
      }),
    );

    const view = await setup();
    await send(view, "troca o fundo", attachment());

    expect(messagesOf(view.result.current.active!.messages)).toEqual([
      "user",
      "ai:loading",
    ]);
    expect(view.result.current.isBusy).toBe(true);

    await act(async () => {
      resolveEdit(succeedsWith("pronto"));
    });

    expect(view.result.current.isBusy).toBe(false);
  });

  it("substitui o carregando pelo resultado da versão 1", async () => {
    const view = await setup();
    await send(view, "troca o fundo", attachment());

    const [, reply] = view.result.current.active!.messages;
    expect(reply && isDoneMessage(reply)).toBe(true);
    if (reply && isDoneMessage(reply)) {
      expect(reply.version).toBe(1);
      expect(reply.comparePct).toBe(50);
      expect(reply.result.name).toBe("fosco-v1.png");
    }
  });

  it("ignora prompt em branco", async () => {
    const view = await setup();
    await send(view, "   ", attachment());

    expect(view.result.current.active!.messages).toHaveLength(0);
    expect(editImageMock).not.toHaveBeenCalled();
  });

  it("responde SEM_IMAGEM quando não há nada para editar", async () => {
    const view = await setup();
    await send(view, "troca o fundo", null);

    const [, reply] = view.result.current.active!.messages;
    expect(reply?.kind === "ai" && reply.state === "error" && reply.code).toBe(
      "SEM_IMAGEM",
    );
    expect(editImageMock).not.toHaveBeenCalled();
  });

  it("usa o primeiro pedido como título e etiqueta da conversa", async () => {
    const view = await setup();
    await send(view, "troca o céu por um fim de tarde", attachment());
    await send(view, "agora deixa preto e branco", null);

    expect(view.result.current.active!.title).toBe(
      "troca o céu por um fim de tarde",
    );
    expect(view.result.current.active!.tag).toBe("CÉU");
  });
});

describe("edições encadeadas", () => {
  it("usa o resultado anterior como fonte quando não há anexo novo", async () => {
    const view = await setup();
    editImageMock.mockResolvedValueOnce(succeedsWith("resultado-1"));
    await send(view, "troca o fundo", attachment());

    const first = view.result.current.active!.messages[1];
    const firstResult = first && isDoneMessage(first) ? first.result : null;

    await send(view, "agora deixa preto e branco", null);

    const segundaChamada = editImageMock.mock.calls[1]?.[0];
    expect(segundaChamada?.image).toBe(firstResult?.blob);
  });

  it("incrementa a versão a cada edição em cima da anterior", async () => {
    const view = await setup();
    await send(view, "troca o fundo", attachment());
    await send(view, "esquenta a luz", null);
    await send(view, "reforça as sombras", null);

    const versions = view.result.current
      .active!.messages.filter(isDoneMessage)
      .map((message) => message.version);

    expect(versions).toEqual([1, 2, 3]);
  });

  it("reinicia a versão quando o usuário anexa uma imagem nova", async () => {
    const view = await setup();
    await send(view, "troca o fundo", attachment("primeira.png"));
    await send(view, "esquenta a luz", null);
    await send(view, "outra foto agora", attachment("segunda.png"));

    const versions = view.result.current
      .active!.messages.filter(isDoneMessage)
      .map((message) => message.version);

    expect(versions).toEqual([1, 2, 1]);
  });

  it("prefere o anexo novo ao resultado anterior como fonte", async () => {
    const view = await setup();
    await send(view, "troca o fundo", attachment("primeira.png"));

    const nova = attachment("segunda.png");
    await send(view, "outra foto", nova);

    expect(editImageMock.mock.calls[1]?.[0].image).toBe(nova.blob);
  });
});

describe("falha e retry", () => {
  it("vira balão de erro carregando o código do servidor", async () => {
    editImageMock.mockResolvedValue(err("CONTEUDO_BLOQUEADO"));

    const view = await setup();
    await send(view, "algo barrado", attachment());

    const [, reply] = view.result.current.active!.messages;
    expect(reply?.kind === "ai" && reply.state === "error" && reply.code).toBe(
      "CONTEUDO_BLOQUEADO",
    );
  });

  it("não gasta versão numa edição que falhou", async () => {
    editImageMock.mockResolvedValueOnce(err("PROVEDOR_FORA"));
    editImageMock.mockResolvedValueOnce(succeedsWith("depois-do-erro"));

    const view = await setup();
    await send(view, "primeira tentativa", attachment());
    await send(view, "segunda tentativa", attachment());

    const versions = view.result.current
      .active!.messages.filter(isDoneMessage)
      .map((message) => message.version);

    expect(versions).toEqual([1]);
  });

  it("refaz a mesma edição no retry e substitui o erro pelo resultado", async () => {
    editImageMock.mockResolvedValueOnce(err("TIMEOUT"));

    const view = await setup();
    await send(view, "troca o fundo pra Paris", attachment());

    const failed = view.result.current.active!.messages[1]!;
    editImageMock.mockResolvedValueOnce(succeedsWith("na-segunda-vai"));

    await act(async () => {
      view.result.current.retry(failed.id);
    });

    const reply = view.result.current.active!.messages[1];
    expect(reply && isDoneMessage(reply)).toBe(true);
    expect(editImageMock.mock.calls[1]?.[0].prompt).toBe("troca o fundo pra Paris");
    // Reaproveita o mesmo balão em vez de empilhar mais um.
    expect(view.result.current.active!.messages).toHaveLength(2);
  });

  it("não tenta retry num erro sem imagem de origem", async () => {
    const view = await setup();
    await send(view, "sem anexo", null);

    const failed = view.result.current.active!.messages[1]!;
    await act(async () => {
      view.result.current.retry(failed.id);
    });

    expect(editImageMock).not.toHaveBeenCalled();
  });
});

describe("variações", () => {
  it("pede uma edição por slot, com semente distinta em cada", async () => {
    const view = await setup();
    await send(view, "troca o fundo", attachment());

    const reply = view.result.current.active!.messages[1]!;
    await act(async () => {
      await view.result.current.generateVariations(reply.id);
    });

    const seeds = editImageMock.mock.calls.slice(1).map((call) => call[0].seed);
    expect(seeds).toHaveLength(2);
    expect(new Set(seeds).size).toBe(2);
    expect(seeds.every((seed) => typeof seed === "number")).toBe(true);
  });

  it("promove a variação escolhida a resultado e guarda a anterior", async () => {
    const view = await setup();
    await send(view, "troca o fundo", attachment());

    const reply = view.result.current.active!.messages[1]!;
    await act(async () => {
      await view.result.current.generateVariations(reply.id);
    });

    const before = view.result.current.active!.messages[1];
    const anterior = before && isDoneMessage(before) ? before.result : null;
    const escolhida =
      before && isDoneMessage(before) ? before.variations[0] : null;

    await act(async () => {
      view.result.current.promoteVariation(reply.id, escolhida!.id);
    });

    const after = view.result.current.active!.messages[1];
    expect(after && isDoneMessage(after) && after.result.id).toBe(escolhida!.id);
    expect(
      after && isDoneMessage(after) && after.variations.map((v) => v.id),
    ).toContain(anterior!.id);
  });

  it("descarta variações que falharam sem derrubar as que deram certo", async () => {
    const view = await setup();
    await send(view, "troca o fundo", attachment());

    editImageMock.mockResolvedValueOnce(succeedsWith("var-ok"));
    editImageMock.mockResolvedValueOnce(err("PROVEDOR_FORA"));

    const reply = view.result.current.active!.messages[1]!;
    await act(async () => {
      await view.result.current.generateVariations(reply.id);
    });

    const after = view.result.current.active!.messages[1];
    expect(after && isDoneMessage(after) && after.variations).toHaveLength(1);
    expect(after && isDoneMessage(after) && after.variationsLoading).toBe(false);
  });
});

describe("conversas", () => {
  it("abre uma conversa nova e deixa a anterior no rail", async () => {
    const view = await setup();
    await send(view, "troca o fundo", attachment());
    const primeira = view.result.current.active!.id;

    await act(async () => {
      view.result.current.startConversation();
    });

    expect(view.result.current.active!.id).not.toBe(primeira);
    expect(view.result.current.active!.messages).toHaveLength(0);
    expect(view.result.current.railItems.map((item) => item.id)).toContain(
      primeira,
    );
  });

  it("mantém fora do rail a conversa que ainda não tem mensagem", async () => {
    const view = await setup();

    expect(view.result.current.railItems).toHaveLength(0);
  });

  it("alterna o favorito da conversa", async () => {
    const view = await setup();
    await send(view, "troca o fundo", attachment());
    const id = view.result.current.active!.id;

    await act(async () => {
      view.result.current.toggleFavorite(id);
    });
    expect(view.result.current.active!.favorite).toBe(true);

    await act(async () => {
      view.result.current.toggleFavorite(id);
    });
    expect(view.result.current.active!.favorite).toBe(false);
  });
});

describe("comparador", () => {
  it("guarda a posição da barra por mensagem", async () => {
    const view = await setup();
    await send(view, "troca o fundo", attachment());

    const reply = view.result.current.active!.messages[1]!;
    await act(async () => {
      view.result.current.setComparePct(reply.id, 73.5);
    });

    const after = view.result.current.active!.messages[1];
    expect(after && isDoneMessage(after) && after.comparePct).toBe(73.5);
  });
});
