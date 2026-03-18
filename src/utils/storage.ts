const isExtension =
  typeof chrome !== 'undefined' &&
  chrome.storage &&
  chrome.storage.local;

const Storage = {
  async get(key: string): Promise<string | null> {
    if (isExtension) {
      return new Promise<string | null>((resolve) =>
        chrome.storage.local.get(key, (data) => resolve((data[key] as string) ?? null))
      );
    }
    const val = localStorage.getItem(key);
    return val ? val : null;
  },

  async set(key: string, val: string): Promise<void> {
    if (isExtension) {
      return new Promise((resolve) =>
        chrome.storage.local.set({ [key]: val }, resolve)
      );
    }
    localStorage.setItem(key, val);
  },
};

export default Storage;
