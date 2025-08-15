using DxLibDLL;
using sazanka.Core;
using System;
using System.Collections.Generic;
using System.Drawing;

namespace sazanka.App
{
    internal class MainScene : IScene
    {
        private GridPanel _gridPanel;
        public void Activated()
        {
            _gridPanel = new GridPanel(10, 10, new Size(30, 30), new Rectangle(100, 100, 200, 200));

            _gridPanel.ViewportOrigin = new Point(0, 0);
        }

        public void Update()
        {
            // mouse input
            int button = DX.GetMouseInput();
            int wheel = DX.GetMouseWheelRotVol();
            DX.GetMousePoint(out int x, out int y);
            var pos = new Point(x, y);

            // test
            if (wheel != 0)
            {
                _gridPanel.ViewportOrigin += new Size(0, -1 * wheel * 10);
            }

            _gridPanel.Update();

            DX.DrawString(0, 0, $"X={pos.X} Y={pos.Y} {button & 1} {button & 2}", DX.GetColor(255, 255, 255));
            DX.DrawString(0, 20, $"X={_gridPanel.ViewportOrigin.X} Y={_gridPanel.ViewportOrigin.Y}", DX.GetColor(255, 255, 255));
        }
    }
}
