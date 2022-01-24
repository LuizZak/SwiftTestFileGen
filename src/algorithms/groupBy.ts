export function groupBy<K, V>(array: V[], key: (item: V) => K): Map<K, V[]> {
    return array.reduce((prev, item) => {
        const k = key(item);

        const existing = prev.get(k);
        if (!existing) {
            prev.set(k, [item]);
        } else {
            existing.push(item);
        }

        return prev;
    }, new Map<K, V[]>());
}

export function mappedGroupBy<K, V, U>(array: V[], key: (item: V) => K, map: (item: V) => U): Map<K, U[]> {
    return array.reduce((prev, item) => {
        const k = key(item);

        const existing = prev.get(k);
        if (!existing) {
            prev.set(k, [map(item)]);
        } else {
            existing.push(map(item));
        }

        return prev;
    }, new Map<K, U[]>());
}
