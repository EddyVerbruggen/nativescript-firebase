#import "TNSMLKitCameraView.h"
#import "UIImage+TNSMLKitCamera.h"

@implementation TNSMLKitCameraView

int throttleCounter = 0;
static Float32 const maxRGBValue = 255.0;
static CGFloat const jpegCompressionQuality = 0.8;
static int const alphaComponentBaseOffset = 4;
static int const alphaComponentModuloRemainder = 3;

- (id)initWithCaptureSession:(AVCaptureSession *)captureSession {
    AVCaptureVideoDataOutput *dataOutput = [AVCaptureVideoDataOutput new];
    dataOutput.videoSettings = @{ (NSString *)kCVPixelBufferPixelFormatTypeKey : @(kCVPixelFormatType_32BGRA) };
    dataOutput.alwaysDiscardsLateVideoFrames = true;

    if ([captureSession canAddOutput:dataOutput]) {
        [captureSession addOutput:dataOutput];
    }
    [captureSession commitConfiguration];

    dispatch_queue_t queue = dispatch_queue_create("captureQueue", NULL);
    [dataOutput setSampleBufferDelegate:self queue:queue];
    return self;
}

+ (NSMutableData * _Nullable)getInputData:(nonnull UIImage *)img withRows:(int) rows andColumns:(int) columns andType:(NSString *) type {
    CGImageRef image = img.CGImage;
    long imageWidth = CGImageGetWidth(image);
    long imageHeight = CGImageGetHeight(image);
    CGContextRef context = CGBitmapContextCreate(nil,
                                                 imageWidth, imageHeight,
                                                 8,
                                                 imageWidth * 4,
                                                 CGColorSpaceCreateDeviceRGB(),
                                                 kCGImageAlphaNoneSkipFirst);
    CGContextDrawImage(context, CGRectMake(0, 0, imageWidth, imageHeight), image);
    UInt8 *imageData = CGBitmapContextGetData(context);
    
    NSMutableData *inputData = [[NSMutableData alloc] initWithCapacity:0];
    
    bool isFloat32 = [type isEqualToString:@"Float32"];

    for (int row = 0; row < rows; row++) {
        for (int col = 0; col < columns; col++) {
            long offset = 4 * (col * imageWidth + row);
            // ignoring offset 0 (the unused alpha channel)

            if (isFloat32) {
                Float32 red = imageData[offset + 1] / 255.0f;
                Float32 green = imageData[offset + 2] / 255.0f;
                Float32 blue = imageData[offset + 3] / 255.0f;
                
                [inputData appendBytes:&red length:sizeof(red)];
                [inputData appendBytes:&green length:sizeof(green)];
                [inputData appendBytes:&blue length:sizeof(blue)];
            } else {
                UInt8 red = imageData[offset + 1] / 255.0f;
                UInt8 green = imageData[offset + 2] / 255.0f;
                UInt8 blue = imageData[offset + 3] / 255.0f;
                
                [inputData appendBytes:&red length:sizeof(red)];
                [inputData appendBytes:&green length:sizeof(green)];
                [inputData appendBytes:&blue length:sizeof(blue)];
            }
        }
    }
    CGContextRelease(context);
    return inputData;
}

+ (NSData *)scaledData:(nonnull UIImage *)img
              withSize:(CGSize)size
             byteCount:(int)byteCount
           isQuantized:(BOOL)isQuantized {
    CGImageRef cgImage = img.CGImage;
    if (cgImage && CGImageGetWidth(cgImage) > 0 && CGImageGetHeight(cgImage) > 0) {
        NSData *imageData = [TNSMLKitCameraView imageDataFromCGImage:cgImage size:size];
        if (!imageData) {
            return nil;
        }
        const UInt8 *bytes = imageData.bytes;
        
        NSMutableData *scaledBytes = [NSMutableData dataWithLength:byteCount];
        UInt8 *mutableBytes = scaledBytes.mutableBytes;
        
        // Extract the RGB(A) components from the scaled image data while ignoring the alpha component.
        int pixelIndex = 0;
        for (int offset = 0; offset < imageData.length; offset++) {
            if ((offset % alphaComponentBaseOffset) ==
                alphaComponentModuloRemainder) {
                continue;
            }
            mutableBytes[pixelIndex++] = bytes[offset];
        }
        if (!isQuantized) {
            for (int i = 0; i < byteCount; i++) {
                mutableBytes[i] = (Float32)mutableBytes[i]/maxRGBValue;
            }
        }
        return scaledBytes;
    } else {
        return nil;
    }
}

+ (NSData *)imageDataFromCGImage:(CGImageRef)cgImage
                            size:(CGSize)size {
    uint32_t bitmapInfo = kCGBitmapByteOrder32Big | kCGImageAlphaPremultipliedLast;
    int width = size.width;
    int height = size.height;
    size_t scaledBytesPerRow = (CGImageGetBytesPerRow(cgImage) / CGImageGetWidth(cgImage)) * width;
    
    CGColorSpaceRef colorSpace = CGColorSpaceCreateDeviceRGB();
    CGContextRef context = CGBitmapContextCreate(nil, width, height, CGImageGetBitsPerComponent(cgImage), scaledBytesPerRow, colorSpace, bitmapInfo);
    CGColorSpaceRelease(colorSpace);
    if (!context) {
        return nil;
    }
    CGContextDrawImage(context, CGRectMake(0, 0, width, height), cgImage);
    CGImageRef image = CGBitmapContextCreateImage(context);
    CGDataProviderRef dataProvider = CGImageGetDataProvider(image);
    CFDataRef cfData = CGDataProviderCopyData(dataProvider);
    CGImageRelease(image);
    CGContextRelease(context);
    return (__bridge_transfer NSData*)cfData;
}

// TODO remove (unused)
+ (NSArray * _Nullable)resizeImage:(nonnull UIImage *)image {
    int newComponentsCount = 3;
    int batchSize = 1;
    CGSize size = CGSizeMake(224, 224);
    BOOL isQuantized = YES;

    CGImageRef cgImage = [image CGImage];

    NSUInteger imageWidth = CGImageGetWidth(cgImage);

    if (imageWidth <= 0) {
        return nil;
    }

    NSUInteger bytesPerRow = CGImageGetBytesPerRow(cgImage);
    NSUInteger oldComponentsCount = bytesPerRow / imageWidth;

    if (oldComponentsCount < newComponentsCount) {
        return nil;
    }

    CGColorSpaceRef colorSpace = CGColorSpaceCreateDeviceRGB();

    int newWidth = (int)floor(size.width);
    int newHeight = (int)floor(size.height);

    int dataSize = newWidth * newHeight * (int)oldComponentsCount *(int)batchSize;

    size_t bitsPerComponent = CGImageGetBitsPerComponent(cgImage);
    size_t newBytesPerRow = oldComponentsCount * newWidth;

    unsigned char *imageData = (unsigned char*)calloc(dataSize, sizeof(unsigned char));

    //    for (int ii = 0 ; ii < dataSize; ++ii)
    //    {
    //        imageData[ii] = 0;
    //        dataSize[ii] = 0;
    //    }

    //    unsigned char *sourceData = (unsigned char*)calloc(sourceHeight * sourceWidth * 4, sizeof(unsigned char));

    CGContextRef context = CGBitmapContextCreate(NULL, newWidth, newHeight, bitsPerComponent, newBytesPerRow, colorSpace, kCGBitmapByteOrder32Big | kCGImageAlphaPremultipliedLast);

    CGContextDrawImage(context, CGRectMake(0.0f, 0.0f, newWidth, newHeight), cgImage);

    CGContextRelease(context);

    NSMutableArray * scaledImageData = [NSMutableArray new];
    for (int yCoordinate = 0; yCoordinate < newHeight; yCoordinate++) {
        NSMutableArray * rowArray = [NSMutableArray new];
        for (int xCoordinate = 0; xCoordinate < newWidth; xCoordinate++) {
            NSMutableArray * pixelArray = [NSMutableArray new];
            for (int component = 0; component < newComponentsCount; component++) {
                long inputIndex = (yCoordinate * newWidth * oldComponentsCount) + (xCoordinate * oldComponentsCount + component);
                unsigned char pixel = imageData[inputIndex];
                if (isQuantized) {
                    NSLog(@"pixel %hhu", (unsigned char) pixel);
                    [pixelArray addObject: [NSNumber numberWithUnsignedChar:pixel]];
                } else {
                    // Convert pixel values from [0, 255] to [-1, 1].
                    unsigned char newPixel = (Float32)pixel - (255.0 / 2.0) / (255.0 / 2.0);
                    //                    pixelArray.append(pixel)
                    [pixelArray addObject: [NSNumber numberWithUnsignedChar:newPixel]];
                }
            }
            [rowArray addObject:pixelArray];
        }
        [scaledImageData addObject:rowArray];
    }

    return [NSArray arrayWithObject:scaledImageData];
}

#pragma mark - AVCaptureVideoDataOutputSampleBufferDelegate

- (void)captureOutput:(AVCaptureOutput *)output didOutputSampleBuffer:(CMSampleBufferRef)sampleBuffer fromConnection:(AVCaptureConnection *)connection {

    if (self.processEveryXFrames < 1) {
        self.processEveryXFrames = 1;
    }

    if ((throttleCounter++ % self.processEveryXFrames) != 0) {
        return;
    }

    UIImage * image = [self imageFromSampleBuffer:sampleBuffer];
    dispatch_async(dispatch_get_main_queue(), ^{
        [self.delegate cameraDidOutputImage:image];
    });
}

#pragma mark - Helper functions

// Create a UIImage from sample buffer data
- (UIImage *) imageFromSampleBuffer:(CMSampleBufferRef) sampleBuffer
{
    CVImageBufferRef buf = CMSampleBufferGetImageBuffer(sampleBuffer);
    CIImage * ciImage = [CIImage imageWithCVPixelBuffer:buf];
    CIContext * context = [CIContext new];
    CGRect imageRect = CGRectMake(0, 0, CVPixelBufferGetWidth(buf), CVPixelBufferGetHeight(buf));
    struct CGImage * quartzImage = [context createCGImage:ciImage fromRect: imageRect];

    UIImage *image;
    if (self.imageOrientation && self.imageOrientation != UIImageOrientationUp) {
        image = [UIImage imageWithCGImage:quartzImage
                                    scale:1.0f
                              orientation:self.imageOrientation];
    } else {
        image = [UIImage imageWithCGImage:quartzImage];
    }
    CGImageRelease(quartzImage);
    return (image);
}

@end
