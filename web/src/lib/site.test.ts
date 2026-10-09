import { describe, expect, it } from "vitest";
import { DEFAULT_SITE_URL, repoFile, resolveSiteUrl } from "./site";

describe("resolveSiteUrl", () => {
  it("falls back to the production domain when the variable is unset", () => {
    expect(resolveSiteUrl(undefined)).toBe(DEFAULT_SITE_URL);
  });

  it("treats a blank value from a copied .env.example as unset", () => {
    expect(resolveSiteUrl("")).toBe(DEFAULT_SITE_URL);
    expect(resolveSiteUrl("   ")).toBe(DEFAULT_SITE_URL);
    // the layout passes the result to new URL(); a blank string would throw there
    expect(() => new URL(resolveSiteUrl(""))).not.toThrow();
  });

  it("uses a configured domain as given, trimmed", () => {
    expect(resolveSiteUrl(" https://example.org ")).toBe("https://example.org");
  });
});

describe("repoFile", () => {
  it("links into the GitHub repository", () => {
    expect(repoFile("README.md")).toMatch(
      /^https:\/\/github\.com\/rNLKJA\/EM-Algorithm\/blob\/[^/]+\/README\.md$/,
    );
  });
});
