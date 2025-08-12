using System;
using System.Collections.Generic;

namespace sazanka.Core
{
    internal class SceneManager
    {
        private readonly Dictionary<string, IScene> _scenes;
        private IScene _currentScene;

        public SceneManager(Dictionary<string, IScene> scenes)
        {
            _scenes = scenes;
            _currentScene = null;
        }

        public void ChangeScene(string sceneName)
        {
            if (!_scenes.ContainsKey(sceneName))
            {
                throw new Exception($"シーン'{sceneName}' が見つかりません。");
            }

            _currentScene = _scenes[sceneName];
            _currentScene.Activated();
        }

        public void Update()
        {
            _currentScene?.Update();
        }
    }
}
