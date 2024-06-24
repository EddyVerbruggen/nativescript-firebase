import { Utils, Application, OrientationChangedEventData } from "@nativescript/core";
import { MLKitCameraView as MLKitCameraViewBase } from "./mlkit-cameraview-common";

export abstract class MLKitCameraView extends MLKitCameraViewBase {
  private captureSession: AVCaptureSession;
  private captureDevice: AVCaptureDevice;
  private previewLayer: AVCaptureVideoPreviewLayer;
  private cameraView: TNSMLKitCameraView;

  public lastVisionImage;

  disposeNativeView(): void {
    super.disposeNativeView();
    if (this.captureSession) {
      this.captureSession.stopRunning();
      this.captureSession = undefined;
    }
    this.captureDevice = undefined;
    this.previewLayer = undefined;
    this.cameraView = undefined;
    Application.off("orientationChanged");
  }

  createNativeView(): Object {
    let v = super.createNativeView();
    if (this.canUseCamera()) {
      this.initView();
    } else {
      console.log("There's no Camera on this device :(");
    }
    return v;
  }

  private canUseCamera(): boolean {
    try {
      return !!AVCaptureDeviceDiscoverySession &&
          AVCaptureDevice.defaultDeviceWithMediaType(AVMediaTypeVideo) !== null &&
          NSProcessInfo.processInfo.environment.objectForKey("SIMULATOR_DEVICE_NAME") === null;
    } catch (ignore) {
      return false;
    }
  }

  private initView(): void {
    // find a suitable device
    this.captureDevice = AVCaptureDeviceDiscoverySession.discoverySessionWithDeviceTypesMediaTypePosition(
        <any>[AVCaptureDeviceTypeBuiltInWideAngleCamera],
        AVMediaTypeVideo,
        this.preferFrontCamera ? AVCaptureDevicePosition.Front : AVCaptureDevicePosition.Back
    ).devices.firstObject;

    if (this.torchOn) {
      this.updateTorch();
    }

    // begin the session
    this.captureSession = AVCaptureSession.new();
    this.captureSession.sessionPreset = AVCaptureSessionPreset1280x720;

    try {
      const captureDeviceInput = AVCaptureDeviceInput.deviceInputWithDeviceError(this.captureDevice);
      this.captureSession.addInput(captureDeviceInput);
    } catch (e) {
      // likely here, because the camera permission was previously denied (catching, otherwise the app crashes)
      console.log("Error while trying to use the camera: " + e);
      return;
    }

    this.previewLayer = AVCaptureVideoPreviewLayer.layerWithSession(this.captureSession);
    this.previewLayer.videoGravity = AVLayerVideoGravityResizeAspectFill;

    if (Utils.ios.isLandscape()) {
      const deviceOrientation = UIDevice.currentDevice.orientation;
      this.previewLayer.connection.videoOrientation = deviceOrientation === UIDeviceOrientation.LandscapeLeft ? AVCaptureVideoOrientation.LandscapeRight : AVCaptureVideoOrientation.LandscapeLeft;
    } else {
      this.previewLayer.connection.videoOrientation = AVCaptureVideoOrientation.Portrait;
    }

    // note that when rotating back to portrait, this event fires very late.. not much we can do I think
    Application.off(Application.orientationChangedEvent); // just making sure it was off
    Application.on(Application.orientationChangedEvent, this.rotateOnOrientationChange.bind(this));

    setTimeout(() => {
      if (this.ios) {
        this.ios.layer.addSublayer(this.previewLayer);
      }

      if (!this.pause) {
        this.captureSession.startRunning();
      }

      this.cameraView = TNSMLKitCameraView.alloc().initWithCaptureSession(this.captureSession);
      this.cameraView.processEveryXFrames = this.processEveryNthFrame;

      // this orientation is how the captured image is rotated (and shown)
      if (this.rotateRecording()) {
        this.cameraView.imageOrientation = UIImageOrientation.Right;
      }

      this.cameraView.delegate = TNSMLKitCameraViewDelegateImpl.createWithOwnerResultCallbackAndOptions(
          new WeakRef(this),
          data => {},
          this.preProcessImage,
          {});
    }, 0);
  }

  private rotateOnOrientationChange(args: OrientationChangedEventData): void {
    if (this.previewLayer) {
      if (args.newValue === "landscape") {
        const deviceOrientation = UIDevice.currentDevice.orientation;
        this.previewLayer.connection.videoOrientation = deviceOrientation === UIDeviceOrientation.LandscapeLeft ? AVCaptureVideoOrientation.LandscapeRight : AVCaptureVideoOrientation.LandscapeLeft;
      } else if (args.newValue === "portrait") {
        this.previewLayer.connection.videoOrientation = AVCaptureVideoOrientation.Portrait;
      }
    }
  }

  public onLayout(left: number, top: number, right: number, bottom: number): void {
    super.onLayout(left, top, right, bottom);
    if (this.previewLayer && this.ios && this.canUseCamera()) {
      this.previewLayer.frame = this.ios.layer.bounds;
    }
  }

  abstract rotateRecording(): boolean;

  getVisionOrientation(imageOrientation: UIImageOrientation): FIRVisionDetectorImageOrientation {
    if (imageOrientation === UIImageOrientation.Up) {
      return FIRVisionDetectorImageOrientation.TopLeft;
    } else if (imageOrientation === UIImageOrientation.Down) {
      return FIRVisionDetectorImageOrientation.BottomRight;
    } else if (imageOrientation === UIImageOrientation.Left) {
      return FIRVisionDetectorImageOrientation.LeftBottom;
    } else if (imageOrientation === UIImageOrientation.Right) {
      return FIRVisionDetectorImageOrientation.RightTop;
    } else if (imageOrientation === UIImageOrientation.UpMirrored) {
      return FIRVisionDetectorImageOrientation.TopRight;
    } else if (imageOrientation === UIImageOrientation.DownMirrored) {
      return FIRVisionDetectorImageOrientation.BottomLeft;
    } else if (imageOrientation === UIImageOrientation.LeftMirrored) {
      return FIRVisionDetectorImageOrientation.LeftTop;
    } else if (imageOrientation === UIImageOrientation.RightMirrored) {
      return FIRVisionDetectorImageOrientation.RightBottom;
    } else {
      return FIRVisionDetectorImageOrientation.TopLeft;
    }
  }

  protected updateTorch(): void {
    const device = this.captureDevice;
    if (device && device.hasTorch && device.lockForConfiguration()) {
      if (this.torchOn) {
        device.torchMode = AVCaptureTorchMode.On;
        device.flashMode = AVCaptureFlashMode.On;
      } else {
        device.torchMode = AVCaptureTorchMode.Off;
        device.flashMode = AVCaptureFlashMode.Off;
      }
      device.unlockForConfiguration();
    }
  }

  protected pauseScanning(): void {
    if (this.captureSession && this.captureSession.running) {
      this.captureSession.stopRunning();
    }
  }

  protected resumeScanning(): void {
    if (this.captureSession && !this.captureSession.running) {
      this.captureSession.startRunning();
    }
  }

  abstract createDetector(): any;

  abstract createSuccessListener(): any;

  runDetector(image: UIImage, onComplete: () => void) {
    throw new Error("No custom detector implemented, so 'runDetector' can't do its thing");
  }
}

@NativeClass()
class TNSMLKitCameraViewDelegateImpl extends NSObject implements TNSMLKitCameraViewDelegate {
  public static ObjCProtocols = [];
  private owner: WeakRef<MLKitCameraView>;
  private resultCallback: (message: any) => void;
  private preProcessImageCallback: (image: UIImage) => UIImage;
  private options?: any;

  private detector: any;
  private onSuccessListener: any;

  private detectorBusy = false;

  public static createWithOwnerResultCallbackAndOptions(owner: WeakRef<MLKitCameraView>, callback: (message: any) => void, preProcessImageCallback: (image: UIImage) => UIImage, options?: any): TNSMLKitCameraViewDelegateImpl {
    // defer initialisation because the framework may not be available / used
    if (TNSMLKitCameraViewDelegateImpl.ObjCProtocols.length === 0 && typeof (TNSMLKitCameraViewDelegate) !== "undefined") {
      TNSMLKitCameraViewDelegateImpl.ObjCProtocols.push(TNSMLKitCameraViewDelegate);
    }
    let delegate = <TNSMLKitCameraViewDelegateImpl>TNSMLKitCameraViewDelegateImpl.new();
    delegate.owner = owner;
    delegate.options = options;
    delegate.resultCallback = callback;
    delegate.preProcessImageCallback = preProcessImageCallback;
    delegate.detector = owner.get().createDetector();
    delegate.onSuccessListener = owner.get().createSuccessListener();
    return delegate;
  }

  cameraDidOutputImage(image: UIImage): void {
    if (!image || this.detectorBusy) {
      return;
    }

    this.detectorBusy = true;

    const onComplete = () => {
      this.detectorBusy = false;
    };

    this.owner.get().lastVisionImage = image;

    if (this.detector.detectInImageCompletion) {
      this.detector.detectInImageCompletion(this.uiImageToFIRVisionImage(image), (result, error) => {
        this.onSuccessListener(result, error);
        onComplete();
      });

    } else if (this.detector.processImageCompletion) {
      this.detector.processImageCompletion(this.uiImageToFIRVisionImage(image), (result, error) => {
        this.onSuccessListener(result, error);
        onComplete();
      });

    } else {
      this.owner.get().runDetector(image, onComplete);
    }
    image = null;
    // FIX: possible memory issue when picking images many times.
    // Not the best solution, but the only one working for now
    // https://github.com/NativeScript/nativescript-imagepicker/issues/222
    setTimeout(Utils.GC, 200);
  }

  private uiImageToFIRVisionImage(image: UIImage): FIRVisionImage {
    image = this.preProcessImageCallback(image);
    const fIRVisionImage = FIRVisionImage.alloc().initWithImage(image);
    const fIRVisionImageMetadata = FIRVisionImageMetadata.new();
    fIRVisionImageMetadata.orientation = this.owner.get().getVisionOrientation(image.imageOrientation);
    fIRVisionImage.metadata = fIRVisionImageMetadata;
    return fIRVisionImage;
  }
}
