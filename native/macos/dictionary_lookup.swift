import Foundation
import CoreServices

func readWord() -> String {
  let args = CommandLine.arguments.dropFirst()
  return args.joined(separator: " ").trimmingCharacters(in: .whitespacesAndNewlines)
}

let word = readWord()
if word.isEmpty {
  exit(1)
}

let nsWord = word as NSString
let range = CFRange(location: 0, length: nsWord.length)
guard let unmanaged = DCSCopyTextDefinition(nil, nsWord, range) else {
  exit(2)
}

let definition = (unmanaged.takeRetainedValue() as String).trimmingCharacters(in: .whitespacesAndNewlines)
if definition.isEmpty {
  exit(2)
}

print(definition)
