import type { ModelRecord } from "@mlc-ai/web-llm";

export interface ModelVerificationResult {
    model_id: string;
    compatible: boolean;
    vram_required_MB: number;
    estimated_load_time: string;
    estimated_size_GB: number;
    error?: string;
    warnings: string[];
}

/**
 * Verify if a model can run on the current device
 */
export async function verifyModel(model: ModelRecord): Promise<ModelVerificationResult> {
    const warnings: string[] = [];
    const vram_required_MB = model.vram_required_MB || 4096;
    
    // Step 1: Check WebGPU availability
    if (!(navigator as any).gpu) {
        return {
            model_id: model.model_id,
            compatible: false,
            vram_required_MB,
            estimated_load_time: "N/A",
            estimated_size_GB: 0,
            error: "WebGPU not supported in this browser. Try Chrome 113+ or Edge 113+",
            warnings
        };
    }

    // Step 2: Check VRAM requirements
    try {
        const adapter = await (navigator as any).gpu.requestAdapter();
        if (!adapter) {
            return {
                model_id: model.model_id,
                compatible: false,
                vram_required_MB,
                estimated_load_time: "N/A",
                estimated_size_GB: 0,
                error: "Failed to get GPU adapter",
                warnings
            };
        }
        
        // Estimate if model will fit
        // Models typically need: VRAM + 20% buffer for KV cache
        const requiredWithBuffer = vram_required_MB * 1.2;
        
        if (requiredWithBuffer > 8192) {
            warnings.push(`High VRAM requirement (${vram_required_MB}MB). May cause OOM on integrated GPUs.`);
        }
        
        // Step 3: Check model library URL accessibility
        let modelLibOk = false;
        try {
            const response = await fetch(model.model_lib, { method: 'HEAD' });
            modelLibOk = response.ok;
        } catch (e) {
            warnings.push(`Could not verify model library URL: ${e}`);
        }
        
        if (!modelLibOk) {
            warnings.push("Model library URL may be unreachable. Load may fail.");
        }
        
        // Step 4: Estimate load time (very rough estimate)
        // Assuming ~50MB/s average download speed
        const estimatedSizeGB = vram_required_MB / 1024 * 0.8; // Rough estimate
        const estimatedLoadSeconds = (estimatedSizeGB * 1024) / 50;
        const estimated_load_time = estimatedLoadSeconds < 60
            ? `${Math.round(estimatedLoadSeconds)}s`
            : `${Math.round(estimatedLoadSeconds / 60)}m ${Math.round(estimatedLoadSeconds % 60)}s`;

        return {
            model_id: model.model_id,
            compatible: true,
            vram_required_MB,
            estimated_load_time,
            estimated_size_GB: Math.round(estimatedSizeGB * 100) / 100,
            warnings
        };
        
    } catch (e: any) {
        return {
            model_id: model.model_id,
            compatible: false,
            vram_required_MB,
            estimated_load_time: "N/A",
            estimated_size_GB: 0,
            error: `GPU check failed: ${e.message}`,
            warnings
        };
    }
}

/**
 * Get device VRAM info
 */
export async function getDeviceInfo(): Promise<{
    gpu_name: string;
    vram_estimate_MB: number;
    is_integrated: boolean;
}> {
    if (!(navigator as any).gpu) {
        return {
            gpu_name: "WebGPU not supported",
            vram_estimate_MB: 0,
            is_integrated: false
        };
    }

    const adapter = await (navigator as any).gpu.requestAdapter();
    if (!adapter) {
        return {
            gpu_name: "No GPU adapter found",
            vram_estimate_MB: 0,
            is_integrated: false
        };
    }
    
    const info = adapter.info as any;
    const is_integrated = info?.architecture?.toLowerCase().includes('integrated') || false;
    
    // Rough VRAM estimation based on architecture
    let vram_estimate_MB = 4096; // Default assumption
    if (is_integrated) {
        vram_estimate_MB = 2048; // Integrated GPUs typically share system RAM
    } else {
        vram_estimate_MB = 8192; // Dedicated GPUs usually have more
    }
    
    return {
        gpu_name: info?.device || "Unknown GPU",
        vram_estimate_MB,
        is_integrated
    };
}
