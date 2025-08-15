using System.Drawing;

namespace sazanka.App
{
    internal static class PointConversion
    {
        /// <summary>
        /// グローバル座標をビューポート座標に変換します。
        /// </summary>
        /// <param name="pos">グローバル座標</param>
        /// <param name="screenOrigin">ビューポートの基準点を表すグローバル座標</param>
        /// <returns>ビューポート座標</returns>
        public static Point GlobalToViewport(Point pos, Point viewportOrigin)
        {
            return new Point(pos.X - viewportOrigin.X, pos.Y - viewportOrigin.Y);
        }

        /// <summary>
        /// ビューポート座標をグローバル座標に変換します。
        /// </summary>
        /// <param name="pos">ビューポート座標</param>
        /// <param name="screenOrigin">ビューポートの基準点を表すグローバル座標</param>
        /// <returns>グローバル座標</returns>
        public static Point ViewportToGlobal(Point pos, Point viewportOrigin)
        {
            return new Point(pos.X + viewportOrigin.X, pos.Y + viewportOrigin.Y);
        }
    }
}
