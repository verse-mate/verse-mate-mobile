import ExpoModulesCore
import UIKit

/**
 * JS-side representation of `UnderlineRange`. Expo's `Record` machinery
 * decodes plain JS objects into this when used as a Prop type.
 */
struct UnderlineRangeRecord: Record {
  @Field var start: Int = 0
  @Field var end: Int = 0
  @Field var style: String?
  @Field var color: UIColor?
  @Field var thickness: Double?
}

public class DottedUnderlineTextModule: Module {
  public func definition() -> ModuleDefinition {
    Name("DottedUnderlineText")

    View(DottedUnderlineTextView.self) {
      Events("onPress", "onRangeTap")

      Prop("text") { (view: DottedUnderlineTextView, value: String?) in
        view.text = value ?? ""
      }
      Prop("fontSize") { (view: DottedUnderlineTextView, value: Double?) in
        if let v = value { view.fontSize = CGFloat(v) }
      }
      Prop("color") { (view: DottedUnderlineTextView, value: UIColor?) in
        if let v = value { view.textColor = v }
      }
      Prop("fontFamily") { (view: DottedUnderlineTextView, value: String?) in
        view.fontFamily = value
      }
      Prop("fontWeight") { (view: DottedUnderlineTextView, value: String?) in
        view.fontWeight = value
      }
      Prop("letterSpacing") { (view: DottedUnderlineTextView, value: Double?) in
        view.letterSpacing = CGFloat(value ?? 0)
      }
      Prop("lineHeight") { (view: DottedUnderlineTextView, value: Double?) in
        view.lineHeight = CGFloat(value ?? 0)
      }
      Prop("textAlign") { (view: DottedUnderlineTextView, value: String?) in
        switch value {
        case "center": view.textAlign = .center
        case "right":  view.textAlign = .right
        case "left":   view.textAlign = .left
        case "justify": view.textAlign = .justified
        default:       view.textAlign = .natural
        }
      }
      Prop("underlineColor") { (view: DottedUnderlineTextView, value: UIColor?) in
        view.underlineColor = value
      }
      Prop("underlineStyle") { (view: DottedUnderlineTextView, value: String?) in
        view.underlineStyle = value ?? "dotted"
      }
      Prop("underlineThickness") { (view: DottedUnderlineTextView, value: Double?) in
        view.underlineThickness = CGFloat(value ?? 1)
      }
      Prop("ranges") { (view: DottedUnderlineTextView, value: [UnderlineRangeRecord]?) in
        guard let value = value else {
          view.ranges = nil
          return
        }
        view.ranges = value.map { r in
          UnderlineRangeSpec(
            start: r.start,
            end: r.end,
            style: r.style ?? "dotted",
            color: r.color
          )
        }
      }
      Prop("selectable") { (view: DottedUnderlineTextView, value: Bool?) in
        view.selectable = value ?? true
      }
      Prop("accessibilityLabel") { (view: DottedUnderlineTextView, value: String?) in
        view.accessibilityLabel = value
      }
    }
  }
}
