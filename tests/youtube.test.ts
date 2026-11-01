import { describe, expect, it } from "vitest";
import { duurSeconden, tijdLink, videoIdUitUrl } from "../src/lib/videos/youtube";

describe("YouTube-hulpfuncties", () => {
  it("herkent video-id's in gangbare URL-vormen", () => {
    for (const u of ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "https://youtu.be/dQw4w9WgXcQ?t=10", "https://m.youtube.com/watch?v=dQw4w9WgXcQ&list=x", "https://www.youtube.com/embed/dQw4w9WgXcQ", "https://www.youtube.com/shorts/dQw4w9WgXcQ", "dQw4w9WgXcQ"])
      expect(videoIdUitUrl(u)).toBe("dQw4w9WgXcQ");
    expect(videoIdUitUrl("https://example.org/watch?v=dQw4w9WgXcQ")).toBeNull();
  });
  it("maakt tijdlinks en leest ISO-duur", () => {
    expect(tijdLink("dQw4w9WgXcQ", 754.9)).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=754s");
    expect(duurSeconden("PT1H2M3S")).toBe(3723);
    expect(duurSeconden("PT45M")).toBe(2700);
  });
});
