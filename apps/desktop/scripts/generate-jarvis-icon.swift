#!/usr/bin/env swift
import AppKit

extension NSColor {
  convenience init(hex: UInt32, alpha: CGFloat = 1.0) {
    let r = CGFloat((hex >> 16) & 0xff) / 255.0
    let g = CGFloat((hex >> 8) & 0xff) / 255.0
    let b = CGFloat(hex & 0xff) / 255.0
    self.init(deviceRed: r, green: g, blue: b, alpha: alpha)
  }
}

let output = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : "assets/icon.png"
let size: CGFloat = 1024
let rect = NSRect(x: 0, y: 0, width: size, height: size)
let image = NSImage(size: rect.size)

image.lockFocus()
let context = NSGraphicsContext.current!
context.imageInterpolation = .high
context.shouldAntialias = true

NSColor.clear.setFill()
rect.fill()

let appRect = rect.insetBy(dx: 34, dy: 34)
let background = NSBezierPath(roundedRect: appRect, xRadius: 224, yRadius: 224)

NSGraphicsContext.saveGraphicsState()
background.addClip()

let baseGradient = NSGradient(colorsAndLocations:
  (NSColor(hex: 0x031421), 0.00),
  (NSColor(hex: 0x071A34), 0.30),
  (NSColor(hex: 0x10236B), 0.66),
  (NSColor(hex: 0x2D135F), 1.00)
)!
baseGradient.draw(in: appRect, angle: -38)

let cyanGlow = NSGradient(colorsAndLocations:
  (NSColor(hex: 0x66F2FF, alpha: 0.72), 0.00),
  (NSColor(hex: 0x009DFF, alpha: 0.28), 0.36),
  (NSColor(hex: 0x009DFF, alpha: 0.00), 1.00)
)!
cyanGlow.draw(fromCenter: NSPoint(x: 332, y: 720), radius: 12, toCenter: NSPoint(x: 332, y: 720), radius: 610, options: [])

let violetGlow = NSGradient(colorsAndLocations:
  (NSColor(hex: 0x9C6CFF, alpha: 0.54), 0.00),
  (NSColor(hex: 0x6E45FF, alpha: 0.22), 0.42),
  (NSColor(hex: 0x6E45FF, alpha: 0.00), 1.00)
)!
violetGlow.draw(fromCenter: NSPoint(x: 710, y: 296), radius: 10, toCenter: NSPoint(x: 710, y: 296), radius: 620, options: [])

let inner = NSBezierPath(roundedRect: appRect.insetBy(dx: 28, dy: 28), xRadius: 198, yRadius: 198)
NSColor(hex: 0xFFFFFF, alpha: 0.10).setStroke()
inner.lineWidth = 3
inner.stroke()

let orbitalRect = NSRect(x: 162, y: 158, width: 700, height: 700)
for (inset, lineWidth, alpha) in [(CGFloat(0), CGFloat(14), CGFloat(0.28)), (CGFloat(54), CGFloat(7), CGFloat(0.32)), (CGFloat(108), CGFloat(4), CGFloat(0.24))] {
  let ring = NSBezierPath(ovalIn: orbitalRect.insetBy(dx: inset, dy: inset))
  NSColor(hex: 0x70E9FF, alpha: alpha).setStroke()
  ring.lineWidth = lineWidth
  ring.stroke()
}

let slash = NSBezierPath()
slash.move(to: NSPoint(x: 192, y: 250))
slash.curve(to: NSPoint(x: 826, y: 758), controlPoint1: NSPoint(x: 356, y: 522), controlPoint2: NSPoint(x: 620, y: 680))
NSColor(hex: 0x9CEBFF, alpha: 0.27).setStroke()
slash.lineWidth = 20
slash.lineCapStyle = .round
slash.stroke()

let sparkle = NSBezierPath(ovalIn: NSRect(x: 726, y: 704, width: 42, height: 42))
NSColor(hex: 0xE9FCFF, alpha: 0.90).setFill()
sparkle.fill()
NSColor(hex: 0x64DFFF, alpha: 0.65).setStroke()
sparkle.lineWidth = 10
sparkle.stroke()

NSGraphicsContext.restoreGraphicsState()

NSGraphicsContext.saveGraphicsState()
let shadow = NSShadow()
shadow.shadowColor = NSColor.black.withAlphaComponent(0.46)
shadow.shadowBlurRadius = 28
shadow.shadowOffset = NSSize(width: 0, height: -14)
shadow.set()

let font = NSFont.systemFont(ofSize: 650, weight: .black)
let paragraph = NSMutableParagraphStyle()
paragraph.alignment = .center
let j = "J" as NSString
let attrs: [NSAttributedString.Key: Any] = [
  .font: font,
  .paragraphStyle: paragraph,
  .foregroundColor: NSColor(hex: 0xF7FDFF)
]
let textSize = j.size(withAttributes: attrs)
let textRect = NSRect(
  x: (size - textSize.width) / 2 - 2,
  y: (size - textSize.height) / 2 + 18,
  width: textSize.width,
  height: textSize.height
)
j.draw(in: textRect, withAttributes: attrs)
NSGraphicsContext.restoreGraphicsState()

let accentFont = NSFont.systemFont(ofSize: 650, weight: .black)
let accentAttrs: [NSAttributedString.Key: Any] = [
  .font: accentFont,
  .paragraphStyle: paragraph,
  .foregroundColor: NSColor(hex: 0x76F2FF, alpha: 0.20)
]
j.draw(in: textRect.offsetBy(dx: 9, dy: -9), withAttributes: accentAttrs)

NSGraphicsContext.saveGraphicsState()
background.lineWidth = 5
NSColor(hex: 0xB8F7FF, alpha: 0.22).setStroke()
background.stroke()
NSGraphicsContext.restoreGraphicsState()

image.unlockFocus()

if let tiff = image.tiffRepresentation,
   let bitmap = NSBitmapImageRep(data: tiff),
   let png = bitmap.representation(using: .png, properties: [.compressionFactor: 0.92]) {
  try png.write(to: URL(fileURLWithPath: output))
} else {
  fputs("failed to render icon\n", stderr)
  exit(1)
}
