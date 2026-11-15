using System.IO;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEditor.Build;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;

namespace Backbencher.Editor
{
    public static class ProjectSetup
    {
        [MenuItem("Backbencher/Create playable scene")]
        public static void CreateScene()
        {
            if(!EditorSceneManager.SaveCurrentModifiedScenesIfUserWantsTo())return;
            Directory.CreateDirectory("Assets/Backbencher/Scenes");Directory.CreateDirectory("Assets/Backbencher/Rendering");
            var scene=EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Single);
            var camera=new GameObject("Desk Camera").AddComponent<Camera>();camera.orthographic=true;camera.backgroundColor=new Color(.96f,.94f,.89f);camera.clearFlags=CameraClearFlags.SolidColor;
            new GameObject("BACKBENCHER").AddComponent<BackbenchApp>();
            const string rendererPath="Assets/Backbencher/Rendering/DeskRenderer.asset",pipelinePath="Assets/Backbencher/Rendering/DeskURP.asset";
            var renderer=AssetDatabase.LoadAssetAtPath<Renderer2DData>(rendererPath);
            if(renderer==null){renderer=ScriptableObject.CreateInstance<Renderer2DData>();AssetDatabase.CreateAsset(renderer,rendererPath);}
            var pipeline=AssetDatabase.LoadAssetAtPath<UniversalRenderPipelineAsset>(pipelinePath);
            if(pipeline==null){pipeline=ScriptableObject.CreateInstance<UniversalRenderPipelineAsset>();AssetDatabase.CreateAsset(pipeline,pipelinePath);var serialized=new SerializedObject(pipeline);var renderers=serialized.FindProperty("m_RendererDataList");renderers.arraySize=1;renderers.GetArrayElementAtIndex(0).objectReferenceValue=renderer;serialized.ApplyModifiedPropertiesWithoutUndo();}
            GraphicsSettings.defaultRenderPipeline=pipeline;QualitySettings.renderPipeline=pipeline;
            const string scenePath="Assets/Backbencher/Scenes/Desk.unity";EditorSceneManager.SaveScene(scene,scenePath);EditorBuildSettings.scenes=new[]{new EditorBuildSettingsScene(scenePath,true)};
            PlayerSettings.companyName="Backbenchers";PlayerSettings.productName="BACKBENCHER";PlayerSettings.SetApplicationIdentifier(NamedBuildTarget.Android,"com.backbenchers.party");PlayerSettings.defaultInterfaceOrientation=UIOrientation.Portrait;PlayerSettings.Android.forceInternetPermission=true;PlayerSettings.Android.minSdkVersion=AndroidSdkVersions.AndroidApiLevel26;
            AssetDatabase.SaveAssets();Debug.Log("BACKBENCHER ready. Press Play, or build Android with your installed SDK.");
        }
        [MenuItem("Backbencher/Build Android development APK")]
        public static void BuildAndroid()
        {
            if(EditorBuildSettings.scenes.Length==0)CreateScene();
            Directory.CreateDirectory("Builds");
            var report=BuildPipeline.BuildPlayer(new BuildPlayerOptions{scenes=new[]{"Assets/Backbencher/Scenes/Desk.unity"},locationPathName="Builds/Backbencher-dev.apk",target=BuildTarget.Android,options=BuildOptions.Development});
            if(report.summary.result!=UnityEditor.Build.Reporting.BuildResult.Succeeded)throw new System.Exception("Android build failed: "+report.summary.result);
        }
    }
}
