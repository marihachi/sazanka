using System.Drawing;

namespace sazanka.App
{
    internal static class RectangleExtensions
    {
        public static Point GetPoint(this Rectangle self)
        {
            return new Point(self.X, self.Y);
        }

        public static Size GetSize(this Rectangle self)
        {
            return new Size(self.Width, self.Height);
        }
    }
}
