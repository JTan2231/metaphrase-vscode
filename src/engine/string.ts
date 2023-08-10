export const replaceAll = (str: string, find: string, replace: string): string => {
    return str.replace(new RegExp(find.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&"), "g"), replace);
};

export const toPosix = (str: string) => {
    return replaceAll(str, "\\", "/");
};
