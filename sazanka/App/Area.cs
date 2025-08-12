using System.Drawing;

namespace sazanka.App
{
    internal static class PointUtility
    {
        /// <summary>
        /// ワールド座標をスクリーン座標に変換します。
        /// </summary>
        /// <param name="pos">ワールド座標</param>
        /// <param name="screenOrigin">スクリーンの基準点を表すワールド座標</param>
        /// <returns>スクリーン座標</returns>
        public static Point ConvertAbsToRel(Point pos, Point screenOrigin)
        {
            return new Point(pos.X - screenOrigin.X, pos.Y - screenOrigin.Y);
        }

        /// <summary>
        /// スクリーン座標をワールド座標に変換します。
        /// </summary>
        /// <param name="pos">スクリーン座標</param>
        /// <param name="screenOrigin">スクリーンの基準点を表すワールド座標</param>
        /// <returns>ワールド座標</returns>
        public static Point ConvertRelToAbs(Point pos, Point screenOrigin)
        {
            return new Point(pos.X + screenOrigin.X, pos.Y + screenOrigin.Y);
        }
    }

    internal class RectRange
    {
        public Point RangeOrigin { get; set; }
        public Size RangeSize { get; set; }

        public RectRange(int x, int y, int width, int height)
        {
            RangeOrigin = new Point(x, y);
            RangeSize = new Size(width, height);
        }

        public RectRange(Point origin, Size size)
        {
            RangeOrigin = origin;
            RangeSize = size;
        }
    }
}
