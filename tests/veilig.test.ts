import { describe, expect, it } from "vitest";
import { controleerPubliekeUrl } from "../src/lib/http/veilig";

describe("SSRF-bescherming bij URL-import", () => {
  for (const url of ["http://localhost/", "http://127.0.0.1/admin", "http://10.0.0.5/", "http://192.168.1.1/", "http://169.254.169.254/latest/meta-data", "file:///etc/passwd", "ftp://example.org/", "https://user:pw@example.org/", "https://example.org:8080/", "http://[::1]/", "http://intranet/"]) {
    it(`weigert ${url}`, async () => {
      await expect(controleerPubliekeUrl(url)).rejects.toThrow();
    });
  }
});
