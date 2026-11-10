export class SocketRateLimiter {
  private readonly buckets = new Map<string, number[]>();

  allow(
    key: string,
    maxRequests: number,
    windowMs: number,
    now: number = Date.now()
  ): boolean {
    const timestamps = this.buckets.get(key) ?? [];
    const cutoff = now - windowMs;
    const recent = timestamps.filter((t) => t > cutoff);
    if (recent.length >= maxRequests) {
      this.buckets.set(key, recent);
      return false;
    }
    recent.push(now);
    this.buckets.set(key, recent);
    return true;
  }

  clearPrefix(prefix: string): void {
    for (const key of this.buckets.keys()) {
      if (key.startsWith(prefix)) {
        this.buckets.delete(key);
      }
    }
  }
}

