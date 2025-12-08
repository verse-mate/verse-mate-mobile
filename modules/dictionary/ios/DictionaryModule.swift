import ExpoModulesCore
import UIKit

public class DictionaryModule: Module {
  public func definition() -> ModuleDefinition {
    Name("Dictionary")

    // Check if the system dictionary has a definition for a word
    AsyncFunction("hasDefinition") { (word: String) -> Bool in
      return await MainActor.run {
        return UIReferenceLibraryViewController.dictionaryHasDefinition(forTerm: word)
      }
    }

    // Show the system dictionary popup for a word
    AsyncFunction("showDefinition") { (word: String) -> Bool in
      return await MainActor.run {
        guard UIReferenceLibraryViewController.dictionaryHasDefinition(forTerm: word) else {
          return false
        }

        let referenceVC = UIReferenceLibraryViewController(term: word)

        guard let rootViewController = UIApplication.shared.keyWindow?.rootViewController else {
          return false
        }

        // Find the topmost presented view controller
        var topController = rootViewController
        while let presentedVC = topController.presentedViewController {
          topController = presentedVC
        }

        topController.present(referenceVC, animated: true)
        return true
      }
    }
  }
}
