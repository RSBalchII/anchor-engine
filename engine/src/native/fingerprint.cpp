#include "fingerprint.hpp"
#include <array>
#include <immintrin.h> // For AVX2 intrinsics

#ifdef _MSC_VER
#include <intrin.h> // For __popcnt64 on MSVC
#endif

namespace ECE {

    // FNV-1a 64-bit Hash for Token Robustness
    uint64_t Fingerprint::HashToken(const std::string& token) {
        uint64_t hash = 14695981039346656037ULL;
        for (char c : token) {
            hash ^= static_cast<uint64_t>(c);
            hash *= 1099511628211ULL;
        }
        return hash;
    }

    uint64_t Fingerprint::Generate(const std::string& input) {
        // SimHash Vector: 64 buckets initialized to 0
        std::array<int, 64> weights = {0};

        size_t start = 0;
        size_t len = input.length();

        // Tokenizer Loop: Split by whitespace (Basic)
        // Advanced versions use n-grams, but word-level is sufficient for document dedupe.
        for (size_t i = 0; i <= len; ++i) {
            // Delimiter check: simple whitespace chars
            bool is_delimiter = (i == len) || (input[i] == ' ' || input[i] == '\n' || input[i] == '\t' || input[i] == '\r');

            if (is_delimiter) {
                if (i > start) {
                    // Extract token
                    std::string token = input.substr(start, i - start);

                    // Hash the token into 64 bits
                    uint64_t h = HashToken(token);

                    // Update Weights:
                    // If bit K is 1, increment weight[K]. Else decrement.
                    for (int bit = 0; bit < 64; ++bit) {
                        if (h & (1ULL << bit)) {
                            weights[bit]++;
                        } else {
                            weights[bit]--;
                        }
                    }
                }
                start = i + 1;
            }
        }

        // Collapse Weights into Final Hash
        uint64_t fingerprint = 0;
        for (int bit = 0; bit < 64; ++bit) {
            if (weights[bit] > 0) {
                fingerprint |= (1ULL << bit);
            }
        }

        return fingerprint;
    }

    int Fingerprint::Distance(uint64_t a, uint64_t b) {
        uint64_t x = a ^ b; // XOR reveals differing bits

        // Hamming Weight (Population Count)
        // Portable implementation selection
        #if defined(__GNUC__) || defined(__clang__)
            return __builtin_popcountll(x);
        #elif defined(_MSC_VER)
            return static_cast<int>(__popcnt64(x));
        #else
            // Software Fallback (Brian Kernighan's Algorithm)
            int count = 0;
            while (x) {
                x &= (x - 1);
                count++;
            }
            return count;
        #endif
    }

    // AVX2 SIMD optimized distance calculation for multiple pairs
    void Fingerprint::DistanceBatch(const uint64_t* a, const uint64_t* b, int32_t* results, size_t count) {
        size_t i = 0;
        
#ifdef __AVX2__
        // Process 4 at a time using AVX2
        for (; i + 3 < count; i += 4) {
            // Load 4x 64-bit integers into 256-bit registers
            __m256i va = _mm256_loadu_si256(reinterpret_cast<const __m256i*>(&a[i]));
            __m256i vb = _mm256_loadu_si256(reinterpret_cast<const __m256i*>(&b[i]));
            
            // XOR them all at once: C = A ^ B
            __m256i vxor = _mm256_xor_si256(va, vb);
            
            // Extract and popcount (AVX2 doesn't have a vectorized popcount, so we extract)
            // This is still faster due to memory parallelism.
            results[i]   = static_cast<int32_t>(_mm_popcnt_u64(_mm256_extract_epi64(vxor, 0)));
            results[i+1] = static_cast<int32_t>(_mm_popcnt_u64(_mm256_extract_epi64(vxor, 1)));
            results[i+2] = static_cast<int32_t>(_mm_popcnt_u64(_mm256_extract_epi64(vxor, 2)));
            results[i+3] = static_cast<int32_t>(_mm_popcnt_u64(_mm256_extract_epi64(vxor, 3)));
        }
#endif
        
        // Cleanup tail
        for (; i < count; i++) {
            results[i] = static_cast<int32_t>(Distance(a[i], b[i]));
        }
    }
}