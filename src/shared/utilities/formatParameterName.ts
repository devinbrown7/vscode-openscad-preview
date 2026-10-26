/**
 * A parameter's label: its name in words, title-cased, without the group's
 * name in front ("holeDiameter" in group "Hole" is "Diameter"). Only whole
 * words are dropped, and never all of them, so "count" in group "Count"
 * stays "Count" and "holes" in group "Hole" stays "Holes". Any group name
 * works, including ones with regex characters.
 */
export function formatParameterName(
  paramName: string,
  groupName: string,
): string {
  const words = paramName
    .replace(/_/g, " ")
    .replace(/([A-Z])/g, " $1")
    .trim()
    .split(/\s+/);
  const group = groupName.trim().toLowerCase().split(/\s+/);
  const prefixed =
    words.length > group.length &&
    group.every((word, i) => words[i].toLowerCase() === word);

  return (prefixed ? words.slice(group.length) : words)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}
